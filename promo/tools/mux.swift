// 无损封装：已编码的 H.264 视频轨 + 已编码的 AAC 音频轨 → 单个 MP4
// 使用 AVAssetExportPresetPassthrough，视频不重编码
import Foundation
import AVFoundation

var video = "", audio = "", out = "final.mp4", dur = 30.0
var it = CommandLine.arguments.dropFirst().makeIterator()
while let k = it.next() {
    switch k {
    case "--video": video = it.next() ?? ""
    case "--audio": audio = it.next() ?? ""
    case "--out": out = it.next() ?? out
    case "--dur": dur = Double(it.next() ?? "30") ?? 30
    default: break
    }
}
let fm = FileManager.default
try? fm.removeItem(atPath: out)

let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: URL(fileURLWithPath: video))
let aAsset = AVURLAsset(url: URL(fileURLWithPath: audio))

guard let vTrack = vAsset.tracks(withMediaType: .video).first else {
    FileHandle.standardError.write("视频轨缺失\n".data(using: .utf8)!); exit(1)
}
guard let aTrack = aAsset.tracks(withMediaType: .audio).first else {
    FileHandle.standardError.write("音频轨缺失\n".data(using: .utf8)!); exit(1)
}

let range = CMTimeRange(start: .zero, duration: CMTime(seconds: dur, preferredTimescale: 600))
let vComp = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! vComp.insertTimeRange(range, of: vTrack, at: .zero)
vComp.preferredTransform = vTrack.preferredTransform

let aComp = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
// 音频按实际可用长度插入（音频文件时长可能略短于视频）
let aDur = CMTimeGetSeconds(aAsset.duration)
let aRange = CMTimeRange(start: .zero, duration: CMTime(seconds: min(dur, aDur), preferredTimescale: 600))
try! aComp.insertTimeRange(aRange, of: aTrack, at: .zero)

guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else { exit(2) }
export.outputURL = URL(fileURLWithPath: out)
export.outputFileType = .mp4
let sem = DispatchSemaphore(value: 0)
export.exportAsynchronously { sem.signal() }
sem.wait()
if export.status == .completed {
    let sz = ((try? fm.attributesOfItem(atPath: out)[.size]) as? Int) ?? 0
    print("封装完成: \(out)  \(String(format: "%.2f", Double(sz)/1048576)) MB  时长 \(String(format: "%.2f", dur))s  音频 \(String(format: "%.2f", min(dur, aDur)))s")
} else {
    FileHandle.standardError.write("导出失败: \(String(describing: export.error))\n".data(using: .utf8)!); exit(3)
}
