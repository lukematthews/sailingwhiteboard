Yeah — this is a real UX gap, and it’s super common in tools that are secretly “keyframe editors” wearing a friendly whiteboard costume.

Right now Sailing Whiteboard has the classic problem:

The user understands dragging boats…
but not that they’re supposed to drag time first.

To a casual sailor in a bar, “timeline” is not a mental model they came for.

So the question becomes:

How do we make “add a step” feel like the obvious next action?

Let’s brainstorm practical, low-effort wins that fit your vibe.

⸻

The Core Issue (mental model mismatch)

A casual user thinks:
	•	“I move the boat → that’s what happened next”

But the app thinks:
	•	“Move the playhead → then move the boat → that creates a step”

So we need to bridge that gap.

⸻

✅ Best UX Ideas (in order of impact)

⸻

1. “Drag boat → automatically creates next step”

This is the big one.

Instead of requiring timeline movement:
	•	User drags boat forward
	•	App says: “Step 2 created at +10s”

Default behaviour:
	•	If playhead is sitting on Step N…
	•	dragging creates Step N+1 slightly after it

This is how casual people expect it to work.

You can still support advanced timeline editing later.

Rule:

Boat movement implies progression unless user is explicitly editing an existing step.

This one change makes the whole app click.

⸻

2. Big obvious “➕ Add Step” button

When a boat is selected, show:

[ + Add Step Here ]

Clicking it:
	•	duplicates current boat pose
	•	inserts a new step at current time (or +5s)
	•	highlights it

This makes “step” a visible concept.

⸻

3. First-time coachmark overlay

After placing the first boat:

“Now scrub time forward and move the boat again to add Step 2.”

Tiny animated arrow pointing to timeline.

Only once.

This is the Duolingo move: don’t explain upfront, explain when needed.

⸻

4. Ghost preview: “Move boat to create next step”

When playhead is not on an existing step:
	•	show faint dotted boat
	•	tooltip:

“Drag boat to create a new step”

This makes the empty timeline feel actionable.

⸻

5. Timeline should auto-follow interaction

If user drags a boat while playhead is on Step 1:

Instead of editing Step 1, app does:
	•	automatically jumps playhead forward a little
	•	creates Step 2

Feels like:

“Time is moving forward as you act”

That’s intuitive.

⸻

6. Make the timeline feel optional

Right now timeline looks like a requirement.

But casual users want:
	•	story beats, not milliseconds

So shift language:
	•	“Steps” not “Timeline”
	•	“Moments” not “Time”
	•	“Next position” not “Keyframe”

Even just renaming helps massively.

⸻

7. Step creation affordance directly on canvas

Example:

After selecting boat, show a floating button near it:

+ Next Step

Tap → playhead advances + creates step

This avoids timeline entirely.

⸻

8. Autoplay “record mode”

Add a toggle:

🎥 Record Steps

When enabled:
	•	every drag creates a new step automatically
	•	playhead advances as you move

This becomes:

“I’m recording the story”

Casual users LOVE that.

⸻

9. The “Story Mode” lane

Instead of timeline slider handles…

Show:

Step 1 → Step 2 → Step 3

With big cards.

Clicking a step jumps there.

This is way more bar-friendly than a dope sheet.

⸻

10. Provide a “Do this next” empty state

When there is only one step:

Put a banner above timeline:

Step 1 done.
Drag the playhead forward and move the boat again to add Step 2.

Then it disappears after step 2 exists.

⸻

🔥 My strongest recommendation for Sailing Whiteboard

If you do only ONE thing:

✅ Dragging a boat should create the next step automatically

Because that matches how sailors think:

“The boat went here next.”

Not:

“At t=37.5 seconds I inserted a keyframe.”

Timeline editing becomes optional power-user stuff.

⸻

Practical Hybrid Rule (so it doesn’t break pros)

When dragging a boat:
	•	If playhead is exactly on an existing step → edit that step
	•	If playhead is between steps → create a new step
	•	If user holds a modifier key (Alt) → force edit

That gives both worlds.

⸻

Tiny UX Polish That Helps Immediately
	•	Add Step button
	•	Coachmark after first boat
	•	Tooltip on timeline: “Drag to time → then move boat to add next step”

Low cost, high clarity.

⸻

Question for you

Do you want the default experience to feel more like:

A) Recording a story (“move boat, step happens”)
or
B) Editing an animation (“set time, place boat”)

Because that decision shapes everything.

My bet: Sailing Whiteboard wins hardest if it leans A.