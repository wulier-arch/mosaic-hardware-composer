// MOSAIC 视频编码器（单遍）
//   PNG/JPEG 帧序列 → H.264 视频轨
//   WAV(PCM 16bit) → AAC 音频轨
//   同时写入同一个 MP4，避免二次封装造成的重编码画质损失
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO

struct Args {
    var frames = "", out = "out.mp4", audio = "", fps = 30.0, w = 1920, h = 1080
    var bitrate = 15_000_000, dur = 30.0
}
var args = Args()
var it = CommandLine.arguments.dropFirst().makeIterator()
while let k = it.next() {
    switch k {
    case "--frames": args.frames = it.next() ?? ""
    case "--out": args.out = it.next() ?? args.out
    case "--audio": args.audio = it.next() ?? ""
    case "--fps": args.fps = Double(it.next() ?? "30") ?? 30
    case "--w": args.w = Int(it.next() ?? "1920") ?? 1920
    case "--h": args.h = Int(it.next() ?? "1080") ?? 1080
    case "--bitrate": args.bitrate = Int(it.next() ?? "15000000") ?? 15_000_000
    case "--dur": args.dur = Double(it.next() ?? "30") ?? 30
    default: break
    }
}

let fm = FileManager.default
let frameURLs = ((try? fm.contentsOfDirectory(at: URL(fileURLWithPath: args.frames), includingPropertiesForKeys: nil)) ?? [])
    .filter { ["png", "jpg", "jpeg"].contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !frameURLs.isEmpty else { FileHandle.standardError.write("没有找到帧\n".data(using: .utf8)!); exit(1) }

try? fm.removeItem(atPath: args.out)
let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: args.out), fileType: .mp4)

/* ---------- 视频轨 ---------- */
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: args.w, AVVideoHeightKey: args.h,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: args.bitrate,
        AVVideoMaxKeyFrameIntervalKey: Int(args.fps * 2),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoAllowFrameReorderingKey: true,
    ],
])
vIn.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vIn, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: args.w, kCVPixelBufferHeightKey as String: args.h,
])
writer.add(vIn)

/* ---------- 音频轨：解析 WAV 头，取出 PCM 数据 ---------- */
var aIn: AVAssetWriterInput? = nil
var pcmData = Data()
var srcRate = 44100.0
var srcCh = 2

if !args.audio.isEmpty, let blob = try? Data(contentsOf: URL(fileURLWithPath: args.audio)) {
    var pos = 12
    var dataOffset = 0, dataLen = 0
    while pos + 8 <= blob.count {
        let id = String(bytes: blob[pos..<pos+4], encoding: .ascii) ?? ""
        let sz = Int(blob[pos+4]) | Int(blob[pos+5]) << 8 | Int(blob[pos+6]) << 16 | Int(blob[pos+7]) << 24
        if id == "fmt " {
            srcCh = Int(blob[pos+10]) | Int(blob[pos+11]) << 8
            srcRate = Double(Int(blob[pos+12]) | Int(blob[pos+13]) << 8 | Int(blob[pos+14]) << 16 | Int(blob[pos+15]) << 24)
        } else if id == "data" {
            dataOffset = pos + 8
            dataLen = min(sz, blob.count - dataOffset)
        }
        pos += 8 + sz + (sz % 2)
    }
    if dataOffset > 0 && dataLen > 0 {
        pcmData = blob.subdata(in: dataOffset..<(dataOffset + dataLen))
        let ai = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: srcRate,
            AVNumberOfChannelsKey: srcCh,
            AVEncoderBitRateKey: 192_000,
        ])
        ai.expectsMediaDataInRealTime = false
        writer.add(ai); aIn = ai
        print("音频: \(srcCh) 声道 \(Int(srcRate))Hz  PCM \(pcmData.count / 1024)KB")
    }
}

print("视频: \(frameURLs.count) 帧  \(args.w)×\(args.h) @\(args.fps)fps  \(args.bitrate/1000)kbps")

writer.startWriting()
writer.startSession(atSourceTime: .zero)

/* ---------- 写视频 ---------- */
let sem = DispatchSemaphore(value: 0)
var idx = 0
vIn.requestMediaDataWhenReady(on: DispatchQueue(label: "vid")) {
    while vIn.isReadyForMoreMediaData {
        if idx >= frameURLs.count { vIn.markAsFinished(); sem.signal(); return }
        guard let src = CGImageSourceCreateWithURL(frameURLs[idx] as CFURL, nil),
              let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { idx += 1; continue }
        if let pool = adaptor.pixelBufferPool {
            var pb: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
            if let pb = pb {
                CVPixelBufferLockBaseAddress(pb, [])
                if let base = CVPixelBufferGetBaseAddress(pb),
                   let bctx = CGContext(data: base, width: args.w, height: args.h, bitsPerComponent: 8,
                                        bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
                                        space: CGColorSpaceCreateDeviceRGB(),
                                        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) {
                    bctx.draw(img, in: CGRect(x: 0, y: 0, width: args.w, height: args.h))
                }
                CVPixelBufferUnlockBaseAddress(pb, [])
                adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(idx), timescale: CMTimeScale(args.fps)))
            }
        }
        idx += 1
    }
}
sem.wait()

/* ---------- 写音频 ---------- */
if let ai = aIn {
    let bytesPerFrame = 2 * srcCh
    let totalFrames = pcmData.count / bytesPerFrame
    let wantFrames = min(totalFrames, Int(args.dur * srcRate))

    var asbd = AudioStreamBasicDescription(
        mSampleRate: srcRate, mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked,
        mBytesPerPacket: UInt32(bytesPerFrame), mFramesPerPacket: 1,
        mBytesPerFrame: UInt32(bytesPerFrame), mChannelsPerFrame: UInt32(srcCh),
        mBitsPerChannel: 16, mReserved: 0)
    var fd: CMAudioFormatDescription?
    CMAudioFormatDescriptionCreate(allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil,
                                   magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &fd)
    guard let fmtDesc = fd else { FileHandle.standardError.write("音频格式描述创建失败\n".data(using: .utf8)!); exit(4) }

    let asem = DispatchSemaphore(value: 0)
    let chunkFrames = 8192
    var cursor = 0
    ai.requestMediaDataWhenReady(on: DispatchQueue(label: "aud")) {
        while ai.isReadyForMoreMediaData {
            if cursor >= wantFrames { ai.markAsFinished(); asem.signal(); return }
            let n = min(chunkFrames, wantFrames - cursor)
            let off = cursor * bytesPerFrame
            let len = n * bytesPerFrame

            var bb: CMBlockBuffer?
            guard CMBlockBufferCreateWithMemoryBlock(allocator: kCFAllocatorDefault, memoryBlock: nil,
                    blockLength: len, blockAllocator: kCFAllocatorDefault, customBlockSource: nil,
                    offsetToData: 0, dataLength: len, flags: 0, blockBufferOut: &bb) == noErr, let block = bb else {
                cursor += n; continue
            }
            pcmData.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
                _ = CMBlockBufferReplaceDataBytes(with: raw.baseAddress!.advanced(by: off),
                                                  blockBuffer: block, offsetIntoDestination: 0, dataLength: len)
            }
            var timing = CMSampleTimingInfo(
                duration: CMTime(value: 1, timescale: CMTimeScale(srcRate)),
                presentationTimeStamp: CMTime(value: CMTimeValue(cursor), timescale: CMTimeScale(srcRate)),
                decodeTimeStamp: .invalid)
            var sampleSize = bytesPerFrame
            var sb: CMSampleBuffer?
            let st = CMSampleBufferCreateReady(allocator: kCFAllocatorDefault, dataBuffer: block,
                formatDescription: fmtDesc, sampleCount: CMItemCount(n), sampleTimingEntryCount: 1,
                sampleTimingArray: &timing, sampleSizeEntryCount: 1, sampleSizeArray: &sampleSize, sampleBufferOut: &sb)
            if st == noErr, let s = sb { ai.append(s) }
            cursor += n
        }
    }
    asem.wait()
}

let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status == .completed {
    let sz = ((try? fm.attributesOfItem(atPath: args.out)[.size]) as? Int) ?? 0
    print("完成: \(args.out)  \(String(format: "%.2f", Double(sz)/1048576)) MB")
} else {
    FileHandle.standardError.write("编码失败: \(String(describing: writer.error))\n".data(using: .utf8)!)
    exit(3)
}
