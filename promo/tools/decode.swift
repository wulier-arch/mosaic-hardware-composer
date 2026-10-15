// 音频解码：任意格式 → 单声道 16bit WAV（保持源采样率，不做重采样）
import Foundation
import AVFoundation

guard CommandLine.arguments.count >= 3 else { print("用法: decode <in> <out.wav>"); exit(1) }
let inPath = CommandLine.arguments[1], outPath = CommandLine.arguments[2]

let af = try! AVAudioFile(forReading: URL(fileURLWithPath: inPath))
let fmt = af.processingFormat
let frames = Int(af.length)
let ch = Int(fmt.channelCount)
let rate = fmt.sampleRate

guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(frames)) else { exit(2) }
try! af.read(into: buf)
guard let data0 = buf.floatChannelData else { exit(3) }
let n = Int(buf.frameLength)

// 统一为立体声（单声道则复制到双声道）
let outCh = 2
var pcm = [Int16](repeating: 0, count: n * outCh)
for i in 0..<n {
    if ch == 1 {
        let v = Int16(max(-32767, min(32767, data0[0][i] * 32767)))
        pcm[i*2] = v; pcm[i*2+1] = v
    } else {
        pcm[i*2]   = Int16(max(-32767, min(32767, data0[0][i] * 32767)))
        pcm[i*2+1] = Int16(max(-32767, min(32767, data0[1][i] * 32767)))
    }
}

var out = Data()
func le32(_ v: UInt32) -> Data { var x = v.littleEndian; return withUnsafeBytes(of: &x) { Data($0) } }
func le16(_ v: UInt16) -> Data { var x = v.littleEndian; return withUnsafeBytes(of: &x) { Data($0) } }
out.append("RIFF".data(using: .ascii)!); out.append(le32(UInt32(36 + n * 4))); out.append("WAVE".data(using: .ascii)!)
out.append("fmt ".data(using: .ascii)!); out.append(le32(16)); out.append(le16(1)); out.append(le16(UInt16(outCh)))
out.append(le32(UInt32(rate))); out.append(le32(UInt32(rate) * 4)); out.append(le16(4)); out.append(le16(16))
out.append("data".data(using: .ascii)!); out.append(le32(UInt32(n * 4)))
pcm.withUnsafeBufferPointer { out.append(Data(buffer: $0)) }
try! out.write(to: URL(fileURLWithPath: outPath))
print("输出 \(outPath)  \(Int(rate))Hz 立体声  时长 \(String(format: "%.2f", Double(n)/rate))s")
