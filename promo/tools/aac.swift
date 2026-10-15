// WAV(PCM 16bit) → M4A(AAC)，音频专用，避免与视频轨同时写入时的死锁
import Foundation
import AVFoundation

let inPath = CommandLine.arguments[1]
let outPath = CommandLine.arguments[2]
let fm = FileManager.default
try? fm.removeItem(atPath: outPath)

let blob = try! Data(contentsOf: URL(fileURLWithPath: inPath))
var pos = 12, dataOffset = 0, dataLen = 0, ch = 2, rate = 44100
while pos + 8 <= blob.count {
    let id = String(bytes: blob[pos..<pos+4], encoding: .ascii) ?? ""
    let sz = Int(blob[pos+4]) | Int(blob[pos+5]) << 8 | Int(blob[pos+6]) << 16 | Int(blob[pos+7]) << 24
    if id == "fmt " {
        ch = Int(blob[pos+10]) | Int(blob[pos+11]) << 8
        rate = Int(blob[pos+12]) | Int(blob[pos+13]) << 8 | Int(blob[pos+14]) << 16 | Int(blob[pos+15]) << 24
    } else if id == "data" {
        dataOffset = pos + 8; dataLen = min(sz, blob.count - dataOffset)
    }
    pos += 8 + sz + (sz % 2)
}
let pcm = blob.subdata(in: dataOffset..<(dataOffset + dataLen))
let bytesPerFrame = 2 * ch
let totalFrames = pcm.count / bytesPerFrame
print("输入 \(ch) 声道 \(rate)Hz  \(totalFrames) 帧 (\(String(format: "%.2f", Double(totalFrames)/Double(rate)))s)")

let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: outPath), fileType: .m4a)
let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVSampleRateKey: Double(rate),
    AVNumberOfChannelsKey: ch,
    AVEncoderBitRateKey: 192_000,
])
input.expectsMediaDataInRealTime = false
writer.add(input)

var asbd = AudioStreamBasicDescription(
    mSampleRate: Double(rate), mFormatID: kAudioFormatLinearPCM,
    mFormatFlags: kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked,
    mBytesPerPacket: UInt32(bytesPerFrame), mFramesPerPacket: 1,
    mBytesPerFrame: UInt32(bytesPerFrame), mChannelsPerFrame: UInt32(ch),
    mBitsPerChannel: 16, mReserved: 0)
var fd: CMAudioFormatDescription?
CMAudioFormatDescriptionCreate(allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil,
                               magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &fd)
guard let fmtDesc = fd else { exit(2) }

writer.startWriting()
writer.startSession(atSourceTime: .zero)

let sem = DispatchSemaphore(value: 0)
let chunk = 4096
var cursor = 0
input.requestMediaDataWhenReady(on: DispatchQueue(label: "aac")) {
    while input.isReadyForMoreMediaData {
        if cursor >= totalFrames { input.markAsFinished(); sem.signal(); return }
        let n = min(chunk, totalFrames - cursor)
        let off = cursor * bytesPerFrame, len = n * bytesPerFrame
        var bb: CMBlockBuffer?
        guard CMBlockBufferCreateWithMemoryBlock(allocator: kCFAllocatorDefault, memoryBlock: nil,
                blockLength: len, blockAllocator: kCFAllocatorDefault, customBlockSource: nil,
                offsetToData: 0, dataLength: len, flags: 0, blockBufferOut: &bb) == noErr, let block = bb else {
            cursor += n; continue
        }
        pcm.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            _ = CMBlockBufferReplaceDataBytes(with: raw.baseAddress!.advanced(by: off),
                                              blockBuffer: block, offsetIntoDestination: 0, dataLength: len)
        }
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: CMTimeScale(rate)),
                                        presentationTimeStamp: CMTime(value: CMTimeValue(cursor), timescale: CMTimeScale(rate)),
                                        decodeTimeStamp: .invalid)
        var sampleSize = bytesPerFrame
        var sb: CMSampleBuffer?
        if CMSampleBufferCreateReady(allocator: kCFAllocatorDefault, dataBuffer: block, formatDescription: fmtDesc,
            sampleCount: CMItemCount(n), sampleTimingEntryCount: 1, sampleTimingArray: &timing,
            sampleSizeEntryCount: 1, sampleSizeArray: &sampleSize, sampleBufferOut: &sb) == noErr, let s = sb {
            input.append(s)
        }
        cursor += n
    }
}
sem.wait()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status == .completed {
    let sz = ((try? fm.attributesOfItem(atPath: outPath)[.size]) as? Int) ?? 0
    print("完成: \(outPath)  \(sz/1024) KB")
} else {
    FileHandle.standardError.write("失败: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(3)
}
