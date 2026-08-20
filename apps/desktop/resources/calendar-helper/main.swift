import CoreAudio
import EventKit
import Foundation

// wes-calendar-helper: two subcommands for Wes's meeting watcher.
//
//   (default)  print upcoming calendar events (now-5m … now+60m) as JSON:
//              [{"title","start","end","text"}] — text carries location+notes+url
//              for meeting-link detection. Exit 2 + {"error":"denied"} if refused.
//   mic        print {"inUse":bool} — whether the default input device is in
//              use by ANY process (CoreAudio "running somewhere"). This is how
//              browser-based meetings (Google Meet in Chrome) are detected:
//              there's no process to watch, but the mic lights up. No special
//              permission needed; must not touch EventKit so it never triggers
//              the calendar prompt.
//
// Spawned by Wes's main process; macOS attributes permission prompts to the
// responsible (parent) app, so the user sees "Wes".

if CommandLine.arguments.contains("mic") {
    var addr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var deviceID = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    var inUse = false
    if AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &deviceID
    ) == noErr, deviceID != 0 {
        var running: UInt32 = 0
        var runningSize = UInt32(MemoryLayout<UInt32>.size)
        var runningAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        if AudioObjectGetPropertyData(deviceID, &runningAddr, 0, nil, &runningSize, &running) == noErr {
            inUse = running != 0
        }
    }
    print("{\"inUse\":\(inUse)}")
    exit(0)
}

let store = EKEventStore()
let sem = DispatchSemaphore(value: 0)
var granted = false

if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { ok, _ in
        granted = ok
        sem.signal()
    }
} else {
    store.requestAccess(to: .event) { ok, _ in
        granted = ok
        sem.signal()
    }
}
sem.wait()

guard granted else {
    print("{\"error\":\"denied\"}")
    exit(2)
}

let now = Date()
let predicate = store.predicateForEvents(
    withStart: now.addingTimeInterval(-5 * 60),
    end: now.addingTimeInterval(60 * 60),
    calendars: nil
)

let fmt = ISO8601DateFormatter()
var out: [[String: String]] = []
for e in store.events(matching: predicate) where !e.isAllDay {
    let text = [e.location ?? "", e.notes ?? "", e.url?.absoluteString ?? ""]
        .joined(separator: " ")
    out.append([
        "title": e.title ?? "Untitled",
        "start": fmt.string(from: e.startDate),
        "end": fmt.string(from: e.endDate),
        "text": text,
    ])
}

let data = try JSONSerialization.data(withJSONObject: out)
print(String(data: data, encoding: .utf8)!)
