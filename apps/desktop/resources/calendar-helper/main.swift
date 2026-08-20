import EventKit
import Foundation

// wes-calendar-helper: print upcoming calendar events (now-5m … now+60m) as
// JSON. Spawned by Wes's main process; macOS attributes the calendar
// permission prompt to the responsible (parent) app, so the user sees "Wes".
//
// Output: [{"title","start","end","text"}]  (text = location+notes+url, for
// meeting-link detection). Exit 2 with {"error":"denied"} when access is denied.

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
