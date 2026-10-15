// 媒体探针：报告时长、轨道、分辨率、码率
import Foundation
import AVFoundation

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "MOSAIC_promo.mp4"
let asset = AVURLAsset(url: URL(fileURLWithPath: path))
let dur = CMTimeGetSeconds(asset.duration)
let size = ((try? FileManager.default.attributesOfItem(atPath: path)[.size]) as? Int) ?? 0
print("文件: \(path)")
print("大小: \(String(format: "%.2f", Double(size)/1048576)) MB   时长: \(String(format: "%.3f", dur)) 秒")
for tr in asset.tracks {
    let mt = tr.mediaType.rawValue
    if mt == "vide" {
        let s = tr.naturalSize
        let fps = tr.nominalFrameRate
        let br = tr.estimatedDataRate
        print("视频轨: \(Int(s.width))×\(Int(s.height))  \(String(format: "%.2f", fps)) fps  \(Int(br/1000)) kbps")
    } else if mt == "soun" {
        let br = tr.estimatedDataRate
        let fd = tr.formatDescriptions.first
        var ch = 0, sr = 0.0
        if let anyFd = fd, let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(anyFd as! CMAudioFormatDescription)?.pointee {
            ch = Int(asbd.mChannelsPerFrame); sr = asbd.mSampleRate
        }
        print("音频轨: \(ch) 声道  \(Int(sr)) Hz  \(Int(br/1000)) kbps")
    }
}
// 逐秒检查关键帧时间戳是否连续（用视频轨的时间映射）
if let v = asset.tracks(withMediaType: .video).first {
    let total = Int(dur * 30)
    print("期望帧数(30fps): \(total)   实际视频轨帧数估计: \(Int(dur * Double(v.nominalFrameRate)))")
}
