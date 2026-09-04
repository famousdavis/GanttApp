# Change Log

## Version 0.28.20 (2026-09-04)

### Fixed: duplicating a project with a very long name produced a copy you could not tell apart

If you duplicated a project whose name was at or near the maximum length the name field allows, the
copy came back looking exactly like the original the next time the app loaded.

Duplicating a project adds a marker to the end of the new name so you can tell the two apart. The name
field has a maximum length, and anything longer is trimmed to fit when the app saves and reloads your
data. For a name already at that maximum, the marker sat entirely past the limit &mdash; so it was
trimmed away, and the copy came back with a name identical to the original. Two projects, the same
name, no way to tell which was which.

The marker is now guaranteed to survive: when a name is long enough that adding the marker would push
it past the limit, the name is shortened just enough to make room, and the marker is kept. Short names
are completely unaffected and duplicate exactly as before.

There was a second, quieter half to this. The check that stops two copies sharing a name was comparing
the untrimmed new name against the already-trimmed stored ones, so it could never match, and every
duplicate of a long name came out with the same marker number. Shortening now happens before that
check rather than after it, so the check compares like with like and the numbering works.

The problem grew gradually rather than appearing all at once: names one character below the limit lost
the marker but stayed distinguishable, and only at the limit itself did the two names become identical.
Names comfortably under the limit were never affected.

## Version 0.28.19 (2026-09-03)

### Fixed: an internal design note that pointed at a document it was never in

Documentation only. No application code changed and nothing about how the app behaves is different.

Two comments in the import code sent readers to a &ldquo;full version&rdquo; of a design note, said to live in
the project&rsquo;s register of known departures from the import specification. It was never there. The note
itself did exist, as a block of comments at the top of one of the files doing the pointing &mdash; so anyone
who followed the pointer found the document they were sent to, and no note inside it.

The note now lives in the architecture document, where it is discoverable from the documentation
rather than only by reading the code, and both pointers aim at it. It records which places in the code
switch the import into its busy state, which places switch it back, and the risk that gives the note
its reason to exist: a new path that ends an import without switching the state back would leave the
screen stuck until the page is reloaded.

Two entries in that register were also corrected and closed.

The first recorded a possible accessibility gap during a replace-everything import. Measured against
what the page actually does, it describes nothing: the progress announcement it worried a screen
reader might miss was never built, so there is nothing to miss. The entry is kept rather than deleted,
because how it came to be written is the part worth recording &mdash; it reasoned forward from a design that
was intended and never built, rather than backward from what the page does.

The second warned that changes to the duplicate-a-project logic may need copying by hand into the
import code. That is right for shared behaviour and wrong for one specific thing: the two paths name
their copies differently on purpose, and each naming style is pinned by its own tests, so copying one
into the other breaks whichever side is changed. The entry now says which parts may be copied and
which must not.

Both entries now carry a status line saying they are accepted rather than scheduled, following the
register&rsquo;s own stated convention.

## Version 0.28.18 (2026-09-03)

### Fixed: the two release scripts are byte-identical across the suite again

Development tooling only. No application code changed and nothing about how the app behaves is different.

The post-merge check added in v0.28.17 went out to the nine projects in the suite in two slightly
different forms. Partway through that rollout one project's code-style tool objected to how a line in
it was written, so the line was rewritten. The projects that had already received the file kept the
first version.

The two behave identically &mdash; the difference is one function body, and the corrected form simply
computes a value before using it rather than nesting one expression inside another. But these scripts
are deliberately the same file everywhere, so that no project can quietly drift onto its own version of
the release rules, and two forms in circulation is exactly the drift that arrangement exists to
prevent. Every project now carries the corrected one.

The lesson kept rather than the fix: a file that must be identical everywhere should be corrected at
its source and re-sent, not corrected where the problem happened to surface. Fixing it in place is what
produced two forms in the first place.

## Version 0.28.17 (2026-09-03)

### Added: the release step that was enforced only by a written instruction is now enforced by code

Development tooling only &mdash; no application code changed and nothing about how the app behaves is
different.

Releasing this app includes bringing the local copy of the project back into line with the copy on the
server once a release has landed. Merging advances the server; it does not touch the local copy. If the
local one is left behind, every report still reads as though the release arrived everywhere, and the
next release is then built on top of the wrong starting point.

That step existed only as a line in a written checklist, and two mechanisms that look like they should
have covered it could not. The release gate runs *before* a release is merged, so the condition it
would be checking does not exist yet. The automated build cannot check it either, because it is a fact
about the machine doing the release rather than about the project &mdash; a fresh automated copy has no
view of anyone's working copy. That is why the gap was invisible rather than merely unaddressed.

Two checks now cover the two moments.

**Before the release, inside the gate.** The gate now refuses to proceed if the local copy is behind
the server. A release cut on a stale starting point silently leaves out whatever landed in the
meantime, and no other check in the gate can see it, because the files on disk look entirely correct.
Being *ahead* is normal and is not reported &mdash; that is what the release itself is.

**After the release, as its own command.** A new command compares the local copy, the local record of
the server, and the server's own answer, and reports which one disagrees. Three sources rather than
two, because the first two can be stale together and agree with each other while both are wrong.

### Note: what the gate deliberately does not check

The gate does not require a clean working copy, and must not start to. It runs partway through a
release, after the version and release-notes edits are made and before they are committed, so at that
exact moment uncommitted work is expected. Requiring cleanliness there would fail every release. The
clean-copy check belongs to the after-the-merge command, where it is correct.

### Note: why it compares fingerprints instead of reading a command's output

The step had once been reported as done on the strength of a command's closing message, where the
informative line had been cut off by the way the output was trimmed. The message that remained
&mdash; that everything was already current &mdash; cannot distinguish *checked, nothing to do* from
*never checked*. Both checks therefore read the resulting state and compare fingerprints, rather than
trusting what a command said about itself. Running a command is not the same as checking its effect.

### Note: the shared gate script now differs from its siblings until it is copied across

The gate script is deliberately identical in all nine projects in the suite, so that no project can
quietly drift onto its own version of the rules. This release changes that script here first, which
means it is briefly the odd one out. Anyone comparing the nine and finding this one different should
copy this version outward, not replace it with an older one: the older copies are the ones missing the
check. The new behaviour is switched on by a single setting, so a project that receives the script
without that setting keeps working exactly as before.

## Version 0.28.16 (2026-09-03)

### Fixed: typing into a chart date or label and clicking away threw the edit away

The Gantt chart lets you click a date under a bar, a release name, or a legend label and change it
where it sits. Typing a new value and then clicking anywhere else &mdash; another part of the chart,
a tab, a snapshot chip &mdash; discarded what you had typed. Only the small tick button, or the
Enter key on two of the three, saved anything. Clicking away now saves.

The code already knew. The tick button is wired to fire on mouse-down rather than on click, purely
so that it beats the handler that was throwing the edit away; without that trick, pressing the tick
would have discarded the edit too.

Dates are where this mattered. A lost release name or legend label is visible immediately &mdash; the
old text is still there on screen, in your own words. A lost date is not: dates render as a bar on a
chart that may span many months, so a change of a few days moves it by a few pixels. You could
retype it, but only if you noticed, and there is no undo anywhere in this app.

### Changed: an invalid date is now discarded when you click away, rather than trapping you

Nothing valid is lost, and the editor always closes.

If the date you typed cannot be accepted &mdash; a start date after its early finish, say &mdash; then
clicking away discards it and the original date stays. The alternative was worse: keeping the editor
open would have left it following your cursor around the page, unclosable except by fixing a value
you may have been trying to abandon. The tick button and the Enter key are unchanged, and still hold
the editor open on an invalid date so you can correct it.

The check runs against what is in the box at the moment you leave it. An earlier version of this fix
was going to read the "there is an error" flag instead, which records whether a *previous* attempt to
save had failed and is therefore silent about the value you are actually leaving behind.

### The cost, stated plainly

An edit you did not mean to make is now permanent. Clicking away commits, this app has no undo, and
in cloud mode the change reaches everyone the project is shared with. If you take a snapshot while an
edit has just been committed this way, the snapshot records it &mdash; and a snapshot is this app's
only historical record.

Escape still discards, on all three editors, and now does so on the legend labels through the
label's own keyboard handling rather than only through the app-wide one.

### Fixed: opening a legend label and leaving without typing quietly created a project override

Legend labels have two scopes: a global default set in Settings, and a per-project override. Clicking
a label to edit it, then leaving it exactly as you found it, wrote an override anyway. The label
looked identical, but it had silently detached from the global default, a reset arrow appeared beside
it, and a write went out to cloud storage. This was already reachable by pressing the tick on an
unchanged label; making click-away save would have made it reachable by accident. A label committed
unchanged &mdash; including one you typed into and then restored &mdash; now writes nothing.

### Fixed: a legend label editor stayed open on a read-only snapshot

Selecting a saved snapshot puts the chart into a read-only view. Clicking a legend label was already
blocked there, but an editor that was *already open* when you selected the snapshot kept rendering
over the frozen chart. All five legend labels now close, matching the release name and the four dates,
which have always closed. The architecture notes have claimed since v7.0 that read-only mode disables
all inline editing; that claim is true for the first time.

### Note: what this release did not change

Only clicking away commits. Programmatic reloads, a release deleted from another device mid-edit, and
Escape all still discard, deliberately.

Whether a click on a button blurs a text field is browser-dependent and was not measured here, so
nothing above names a specific gesture as guaranteed to save. In every browser the fix is at worst
what the app already did.

### Note: the tests this needed

The two shared editor components were well covered, but the file that renders five of the ten editors
&mdash; four dates and a release name for every release on the chart &mdash; had no interaction tests
at all. Coverage of its functions went from two of seven to seven of seven, and the legend editor
gained its first keyboard and click-away tests. 41 tests were added and two rewritten: both of the
rewritten pair had been asserting the defect.

### Note: a writing convention moved into the file it constrains

Three of the automated checks on the architecture notes work by requiring a retired phrase to be
absent from those notes. That makes correcting one of them delicate: a correction written into the
notes that quotes the wording it is retiring puts that wording straight back into the file and fails
the very check the correction was honouring, with a failure message that looks like a fresh
regression.

The convention that avoids this &mdash; describe a correction without restating what it replaced
&mdash; was set in v0.28.8, but until now it was written down only in a project file that is
excluded from version control, so it was absent from every fresh copy of the repository. That is
exactly the state someone is in the first time they meet the problem. It is now stated in full in
the check file itself, which is also the one place in the repository where naming those retired
phrases is safe, since the checks read the architecture notes and nothing else.

This records the convention; it does not enforce it. Nothing checks that a correction avoids
reprinting, and nothing can: the three checks can only notice a reprint after it has already landed
in the notes, and cannot tell one apart from the original error.

## Version 0.28.15 (2026-09-01)

### Fixed: a number in the mutation-testing configuration that never described the file it named

Development tooling only — no application code changed and nothing about how the app behaves is
different.

Mutation testing makes small deliberate changes to the code and asks whether any test notices. It is
expensive, so it runs against three files rather than all of them, and the configuration records why
each of the others was left out. Two files were listed as excluded for having too little test
coverage, each with a percentage beside it.

One of those percentages had never described the file it was attached to. It was the second of two
figures on a single line of a coverage report — the branch figure and the function figure for the
same file, sitting side by side — and the second had been read as belonging to the file on the next
line. The file it was attributed to has, and has always had, complete coverage of the thing being
measured; neither it nor its test has changed in more than a dozen releases.

The exclusion itself is still right, for a reason the configuration already gives elsewhere: the
file is small and fully covered, and mutating it would return almost nothing. Only the stated reason
was wrong.

### Fixed: a second figure in the same sentence, out of date since the previous release

The other excluded file's coverage rose from 58% to 79% in v0.28.14, when five unused functions were
deleted from it. That clears the threshold its exclusion cited.

Both exclusions still stand and the scope is unchanged. Whether that file should now come into scope
is a separate decision and this release does not make it — the note says so explicitly, so that a
later reader cannot mistake a corrected number for a decision.

### Fixed: a cross-reference that pointed at a document which does not contain what it promised

The same configuration told anyone reading it to see the mutation-testing report "for what was
excluded and why". That report has never contained the name of either excluded file and documents no
exclusion at all — it records the run itself: the score, every surviving change and how each was
classified, and what the run cost. The reference was false on the day it was written and survived
seven releases, because a pointer to a document is exactly the kind of claim nothing ever executes.

The pointer now says where the information actually is.

### Added: a check that the mutation scope and its written record cannot drift apart

Two things are now verified on every release. Every file the configuration puts in scope must exist
— a renamed or deleted entry would otherwise shrink the scope silently, since the tool treats those
entries as patterns and a pattern matching nothing raises no error while quietly lowering the amount
of code under test. And every file in scope must appear in the written record of the run, so the
record cannot describe a run that nobody could reproduce from it.

Stated plainly, because it is the same weakness as the checks added in the last two releases: this
reads names, not prose. A percentage going stale — which is what this release fixed twice — is
invisible to it.

### Changed: the project's own working notes described a source file by what it used to do

The notes listed a snapshot utility file as handling snapshot creation, validation and browser
storage. Only the validation half survived the previous release, and the entry now names the two
things the file actually still does. That file is excluded from version control, so this change
appears in no comparison of what changed and is covered by no automated check beyond the two version
numbers the release gate verifies; it was made by hand and is recorded here.

## Version 0.28.14 (2026-09-01)

### Removed: five unused functions that wrote snapshots straight to browser storage

Internal cleanup — no application code path changed and nothing about how the app behaves is
different.

A utility file for chart snapshots exported seven functions. Five of them had no callers anywhere in
the project. They read and wrote snapshots directly into browser storage, which is how the app
worked before it gained a storage layer that decides between your browser and the cloud depending on
which you have chosen. Once that layer arrived the five became unreachable, and they had sat there
since.

They did not look unused, which is why they lasted. The live storage layer declares operations with
exactly the same names, so searching for any one of them returns dozens of results across the
project — the interface, both implementations, and every place the app saves or deletes a snapshot.
Every one of those is the storage layer. None of them is this file.

Deleted with them: three settings the five functions needed and nothing else did — the name under
which snapshots were filed in browser storage, and two limits on how many snapshots may be kept. The
limits already exist in one other place that describes itself as the single source of truth, so the
copies were a second answer to a question that should only have one.

### Added: a check that the browser-storage key cannot come back

Removing a function that something still uses is caught immediately — the project stops building.
Removing a setting is caught by nothing. This project has no rule that reports an unused setting and
no build option that would fail on one, so the three deleted settings were invisible to every
automated check the release runs, in both directions: leaving them in and taking them out looked
identical.

One of the three is now pinned by name. If that storage key returns to that file, the release fails
and says why. The key is the whole point — anything writing snapshots under it is going around the
storage layer, and would quietly disagree with cloud storage.

What this does not do, stated plainly: it looks for one exact word in one file. The same code
written with a different key, or placed in another file, passes.

### Changed: one line of the architecture notes, and a check pointing the other way

The architecture notes described that file as handling snapshot creation, validation and browser
storage. Only the validation half is true now, and the line names the two things the file actually
still does.

A second check was added that points in the opposite direction from every other check on those
notes: it requires text to be present. The notes correctly list the storage layer's operations, and
those share their names with the five deleted functions. Anyone searching the notes for the deleted
names finds nine lines of accurate documentation and is invited to delete them while believing they
are correcting an error. One of those nine lines is now pinned, so deleting it fails the release.

Both checks look for exact wording, like the two added in the previous release, and have the same
weakness: reword a stale claim and it passes. They guard the specific sentences this release
touched, and nothing beyond them.

### Added: the first tests for the keyboard-shortcuts handler

The app has a keyboard-shortcuts handler wired into three screens. It listens for every key press
across the whole window, cancels the browser's own response when it recognises a combination, and
takes over Ctrl+S and Cmd+S so the browser's save dialog does not open. It had never once run in a
test. One of its twenty-one possible outcomes was covered, and that one was the default value of an
argument.

All twenty-one are covered now. Four of them are worth naming, because they are easy to get wrong
and invisible from the outside:

- Escape reaches you even while you are typing in a text field. It is deliberately checked before
  the rule that ignores shortcuts in text fields, so it is the one shortcut that still works there.
- Escape does not cancel the browser's own response, while every other recognised shortcut does.
- That is only true when an Escape shortcut has actually been registered. Without one, Escape is
  treated as an ordinary key — so a combination such as Ctrl+Escape does cancel the browser's
  response, contradicting both points above in the case nobody thinks to check.
- Combinations are matched in one fixed order: Ctrl, then Shift, then the key. Written the other way
  round, a shortcut can never match.

The handler itself was not changed.

### Note: what the coverage figures do and do not entitle

Measured coverage of the snapshot utility file rose because its untested half is gone, not because
anything new was tested there: statements from 41% to 84%, branches from 58% to 79%. That clears the
coverage threshold recorded as the reason for leaving the file out of the project's mutation-testing
scope.

It does not meet the higher standard the files actually in that scope were held to. This release
therefore makes no claim that the file is now a candidate; that decision is separate and unchanged.

## Version 0.28.13 (2026-08-31)

### Fixed: the architecture notes described files and behaviour that no longer exist

Documentation only — no application code changed and nothing about how the app behaves is
different.

The project's architecture notes are what every later piece of work reads to decide what to build.
They had drifted. They named a file deleted in an earlier release, a second deleted before that, and
a third that never existed at all. They described a pop-up error message this app has never had, in
any version. They listed the versions of six of the project's own tools, and all six were wrong —
one of them wrong about which major version the project is on. They described a saved-changes delay
as more than twice its actual length, and a delete confirmation as a browser pop-up that was
replaced with an in-app dialog many releases ago.

Each of those was true when it was written. None of them was true any more, and nothing anywhere
would have caught that.

### Added: a check that the architecture notes cannot name a file that does not exist

Every filename mentioned in the architecture notes is now checked against the files actually in the
project. A name that resolves nowhere fails the release. One exception is recorded on purpose — a
security-rules file that genuinely lives in a different repository — and the check refuses to let
that exception quietly grow: if the file ever moves into this project, or stops being mentioned, the
exception itself is flagged as stale.

Two retired claims are also pinned. The pop-up error message wording is refused if it reappears; it
had already been copied to a fourth place before anyone noticed. So is the name of the deleted
storage class, separately — because the filename check only sees filenames, and the class name
appears in prose and in a diagram, where a filename check is blind to it.

### Note: what this check does not do, stated plainly

It only checks that what is named exists. It cannot notice something the notes forgot to mention,
and 29 of the project's 100 source files are not mentioned. Rather than pretend otherwise, the
directory listing in those notes now says it is a guide to the important files rather than a
complete index — so an omission stops being a fault. Regenerating it automatically was considered
and rejected: three fifths of its lines carry hand-written explanations that a regenerated listing
would delete, and it would grow to more than twice the length while explaining less.

The check also cannot see a claim that names no file. Wrong version numbers, wrong timings, and
wrong descriptions of behaviour were all corrected by hand here, and nothing stops them going stale
again.

### Changed: two deferred items now say they are deferred

Two recorded deviations from the import specification named a version by which they would be fully
resolved. That version shipped without them and the project is now several releases past it, so the
notes were promising something already overdue. Both now say they are open and unscheduled, with the
date removed rather than moved to a new one that would rot the same way. A third is marked as
accepted rather than pending: it describes a problem that cannot occur in the current design, and
recording it as outstanding work overstated it.

### Note: the backlog is not now honest, and this release does not claim it is

Ten items were reviewed. Five of them live in historical release records, which are deliberately not
edited — a record that was accurate when written is not stale, and rewriting it would assert it had
been wrong. Those five are exactly as hard to find today as they were before this release. The five
that could be corrected were corrected. Naming that limit is the point; a release that closed half a
list and reported it as closed would be the same failure this one exists to fix.

### Note: some of this release is invisible to review

Part of the corrected documentation is a file excluded from version control, so those changes appear
in no comparison of what changed and are covered by no automated check beyond two version numbers
the release gate verifies. They were reviewed by hand and recorded in full in the release report.

## Version 0.28.12 (2026-08-22)

### Fixed: the mutation-testing safety check no longer passes the run it exists to catch

Development tooling only — no application code changed and nothing about how the app behaves is
different.

Mutation testing makes small deliberate changes to the code and asks whether any test notices. A
wrapper around it exists to refuse a run that produced no real results but reports a clean-looking
one, because that failure is silent and flattering — the worst combination.

The wrapper counted "no test reaches this code" as a real result. So a run in which every single
change went unchecked — a score of zero per cent, nothing actually tested — was reported as having
produced real verdicts. That is the precise failure it was written to prevent, surviving inside it.

The fix separates two questions that had been sharing one sum. Whether a change was left unchecked
is a real fact about the code, and still counts towards the score exactly as before. Whether the
suite ever ran at all is a different question, and an unchecked change is silence rather than
evidence. Only the second question changed. One line of running code differs.

### Changed: the note explaining it names no cause, deliberately

The suite's records attributed the all-unchecked state to one specific misconfiguration. Five
attempts were made to produce that state on purpose, across two sibling projects, including the one
where the misconfiguration should do the most damage. None of them produced it — the tool either
refuses to start when no test covers the changed code, or runs the whole suite and reports the
changes as surviving instead. The records were describing behaviour the tools no longer have.

So the replacement note describes the state being refused and names no trigger for it. A note that
explains a fault by pointing at one cause stops being true when the cause changes; a note describing
what is refused does not.

### Note: this project has no stored measurement, so it contributes no evidence here

Four hand-built cases were run through the real checking script, before and after the change, and
every stored measurement in the projects that keep one still passes with an identical score. This
project does not keep one on disk, so it is covered by the shared-file check and by its own build,
but not by that regression evidence. Saying so is the point: three projects checked is not four.

## Version 0.28.11 (2026-08-22)

### Fixed: the release-checking script no longer says there is no automated checking

Development and release tooling only — no application code changed and nothing about how the
app behaves is different.

The script that checks a release before it ships is deliberately the same file in all nine
SPERT® Suite projects. The note at the top of it said there was no automated checking anywhere
in the suite: that a green tick on a proposed change meant only that a preview copy had been
built, and that nothing ran the tests. That has not been true since the script existed.
Automated checking runs on every one of the nine projects, on every proposed change and on
every merge, and what it runs is this very script.

The statement did not go out of date. It was untrue on the day it was written — the same set of
edits that added the script also switched the automated checking on, so the file contradicted a
change sitting beside it. That distinction decides the remedy, which is why it is recorded here.
A statement that decays can be helped by writing down when it was made; a statement that was
never true cannot. What went wrong was that a claim about the projects was written into an
explanation without being checked against them, and an explanation is read as background rather
than as an assertion somebody has to verify.

### Added: two explanations that were missing from the same file

The first records that automated checking and a check run by hand are complementary rather than
ranked. The automated one works from a clean copy, so it catches anything that quietly depends
on a file existing only on the author's own machine; but it also has less of the project to look
at, so certain checks step aside there and only a hand-run finds what those cover.

The second explains how the code-style step is judged. That step compares the number of reported
issues against an agreed figure instead of reading pass or fail, and it does so for opposite
reasons in different projects: in most of them the step reports failure at the agreed figure, so
reading pass-or-fail would be too strict; in one it reports success at the agreed figure, so
reading pass-or-fail would be too lenient and would let new issues through unnoticed. One
mechanism, two reasons. The note also warns that the figure counts every kind of issue rather
than the one kind a project set it for, and that when it reaches zero the setting must be removed
rather than set to zero — at zero the tool prints no count at all, and the step then fails asking
for a number that was never printed.

### Changed: a note in this project stopped pointing at a line number

The accepted-issue-count note in `shipgate.config.json` cited two line numbers inside that shared
script. Adding lines to the top of it moved both. The note now names the part of the script it
means. A stale line number is worse than a missing one: it lands on real code, so a reader who
follows it finds something plausible and concludes the reference was sound.

## Version 0.28.10 (2026-08-20)

### Fixed: a snapshot that fails to save no longer fails silently

Saving a chart snapshot could fail and the app would not tell you. No error, no warning, nothing
on screen — the snapshot simply never appeared, and it was left to you to notice it was missing.
Deleting a snapshot could fail the same silent way, and so could the snapshot tidy-up that runs
when you delete or clone a project.

All four of those actions now tell you when they do not work, and say what it was they could not
do. Deleting a project whose snapshots could not be removed says exactly that, rather than
implying the whole thing failed.

Where the app already has something specific and useful to tell you, that is what you now see.
Running out of room in your browser says so and tells you to export your data and clear some
space, instead of being flattened into a vague "something went wrong".

This matters in both places your data can live. On the app's default local storage, the likely
cause is the browser running out of room. With cloud storage turned on, it is more likely a
permissions problem with your account. Either way, the app now says so.

The particular fault that prompted this was repaired separately: for seven days in August,
snapshots saved by cloud users who had set a status date were being rejected by the server. That
is fixed. What this release fixes is the reason nobody noticed for seven days.

Importing a file that replaces your snapshots already reported its own failures, and is
unchanged.

### Removed: an obsolete backup copy of the app's main page

A superseded copy of the main page had been sitting in the project since January — 2,616 lines
of code replaced long ago. It was never loaded and never run; it was only a confusing thing to
stumble across when reading the source. Its history is kept in version control.

## Version 0.28.9 (2026-08-19)

### Changed: Microsoft sign-in now requires a work or school account

Personal Microsoft accounts — outlook.com, hotmail.com, live.com — are no longer accepted. Microsoft
itself enforces this, so such an account is refused at the sign-in screen before any password is
entered. The change was made for institutions evaluating the Suite, who reasonably expect "sign in
with Microsoft" to mean an organisational account rather than any account at all.

Nothing changes for personal use: Google still accepts personal accounts. The cloud storage window
and the Settings page now say so, rather than letting you choose Microsoft and discover the
restriction from an error message.

## Version 0.28.8 (2026-08-18)
### Changed: the previous entry no longer repeats the wording it replaced

Documentation only &mdash; no code changed, and nothing about how the app behaves is different.

The v0.28.7 entry explained its own change by quoting the old heading it had just removed. That put the discarded wording back into the newest entry of this file and into the first item shown on the in-app Change Log &mdash; more prominently than it had ever appeared in the entry being corrected.

The explanation now describes the problem without restating it. The v11.0 entry itself is unchanged from v0.28.7 and remains correct.

## Version 0.28.7 (2026-08-18)
### Changed: a v11.0 changelog entry now says what it records, not why

Documentation only &mdash; no code changed, and nothing about how the app behaves is different.

An entry from v11.0 (February 2026) described a data-recording feature by its purpose rather than by what it records, which left the reader to work out what is actually stored about them.

It now says what is recorded: a project stored in the cloud carries the account that created it, and keeps a rolling audit trail of edits, capped at fifty entries with the oldest dropped. **The behaviour is unchanged and has been in place since v11.0** &mdash; only the description of it has. Exports have always been labelled plainly and are untouched.

The entry was reworded rather than annotated because it is not only a historical record: it is served from this site and rendered inside the app, so anyone reading it today was being told the less useful of the two things. Recording the correction here is the changelog doing the job it exists for.

## Version 0.28.6 (2026-08-18)
### Maintenance: a first mutation-testing baseline

Dev-tooling only &mdash; no shipped-bundle impact, and no application code was changed in this release.

Mutation testing checks a test suite by deliberately introducing small faults into the code &mdash; flipping a comparison, emptying a branch, altering a constant &mdash; and asking whether any test notices. A fault no test notices marks a place where the tests assert less than they appear to. Three files were measured: the data-validation, import/export and local-storage modules, chosen because a fault in them has no independent check anywhere else in the system.

The run produced 1,311 faults, of which 893 could be judged. 611 were caught. Of the 209 that survived, 33 were confirmed harmless &mdash; a guard duplicated a check already performed a line later, or the altered text was a log message nothing asserts on. The remaining 176 are recorded as genuine observations: mostly boundary comparisons tested from one side, whitelist entries where one member is exercised and the rest are not, and error-message mappings where individual cases are never reached.

**Nothing was fixed in response, and no target was set.** The result is a record, not a gate &mdash; it cannot fail a release, and the survivors are written down rather than worked off. A first measurement whose findings are immediately remediated tells you nothing about what the measurement is worth.

Full detail, including how each surviving fault was classified and why, is in `docs/mutation-baseline.md`.

## Version 0.28.5 (2026-08-18)
### Maintenance: a complexity ratchet on the release gate

Dev-tooling only &mdash; no shipped-bundle impact and no app behavior changes. No application code was modified in this release.

The release gate now measures **cognitive complexity** &mdash; roughly, how hard a function is to hold in your head while changing it safely &mdash; and holds the current number steady. Thirteen functions across the codebase sit above the threshold of 15. That count is now recorded as the accepted baseline, and the gate fails if it moves in either direction: upward, because new hard-to-follow code was introduced; downward, because something was simplified and the record should be updated to match. Both directions were deliberately provoked and confirmed before release.

**Nothing was refactored to satisfy it, and zero is explicitly not the goal.** These thirteen are accepted, not owed. Refactoring a function purely to move a number is the wrong trade; the ratchet exists to make the number visible and to stop it drifting quietly upward.

The measurement covers the whole repository rather than a chosen subset. The deciding evidence was that all thirteen functions are exercised by the test suite &mdash; none sits in untested code &mdash; so there was no case for narrowing to the better-tested parts. The two most complex functions also live in the chart-drawing code, which any narrower boundary would have excluded.

A companion command, `npm run cc`, reports the complexity of every function in a file, including those under the threshold, and can estimate what a block of code would measure if it were lifted into its own function. It is a measuring instrument, not a gate.

## Version 0.28.4 (2026-08-18)
### Maintenance: pinned dependency overrides and a deterministic lint

Dev-tooling only &mdash; no shipped-bundle impact and no app behavior changes. Both halves exist to make an upcoming code-quality measurement trustworthy, and both had to land before it.

The three remaining floating version ranges in `overrides` are now pinned exact: `postcss` `^8.5.18` &rarr; `8.5.23`, `sharp` `^0.35.0` &rarr; `0.35.3`, `protobufjs` `^7.6.5` &rarr; `7.6.5`. Each target equals the version already installed, so nothing moves &mdash; the lockfile is untouched by the change. The reason for pinning is that overridden packages are, by construction, indirect dependencies, and the tooling that watches for versions adopted too soon after publication only inspects direct ones. Nothing was watching these three. Both floors were confirmed still doing their job: `next` asks for `postcss` 8.4.31 and `sharp` 0.34.x, and neither appears anywhere in the installed tree.

`coverage/` is now excluded from linting. The coverage reporter writes generated JavaScript carrying suppression comments that the linter then reports as unnecessary &mdash; three warnings that appear only in a working copy where coverage has been run, and never in a clean checkout. Since an upcoming change reads the linter's problem count as a fixed baseline, a count that depends on whether someone happened to run coverage recently is not a baseline at all. The exclusion was verified in both directions with the coverage output present, so the check could not pass merely because there was nothing to find.

All 1323 tests pass, and lint, type-check and the production build are clean.

## Version 0.28.3 (2026-08-18)
### Maintenance: dependency security updates

Dev-tooling only &mdash; no shipped-bundle impact and no app behavior changes.

`brace-expansion` moves to its fix floor on all three release lines this project installs &mdash; 1.1.16 &rarr; 1.1.18, 2.1.2 &rarr; 2.1.4 (three copies), 5.0.8 &rarr; 5.0.9 &mdash; clearing GHSA-mh99-v99m-4gvg and GHSA-rgw5-rvv9-x895. Done with `npm update`, deliberately not an override: `brace-expansion` 5.x drops the `expand` export that `minimatch` below 5 still calls, so forcing a 5.x copy under an old `minimatch` installs cleanly, dedupes, lowers the audit count, and then throws at the first brace expansion. Every `minimatch` in the tree was checked afterwards by resolving what it actually loads, not what it declares; all five still load a compatible line.

`@vitejs/plugin-react` moves 5.1.4 &rarr; 5.2.0. No advisories at any version; it is taken now for sequencing, being the first release whose `vite` peer range spans both the current major and the next, which keeps that later upgrade a single-package edit rather than a coupled one. It pulls in no new dependencies.

The four packages held at fixed versions &mdash; `postcss`, `sharp`, `protobufjs` and `vite` &mdash; were verified byte-identical before and after. All 1323 tests pass, and lint, type-check and the production build are clean.

## Version 0.28.2 (2026-08-18)
### Maintenance: type errors in test files are now caught before release

Internal tooling only &mdash; nothing about the app changes. Three type errors had been sitting in the project&rsquo;s own test files since v0.27.15 with nothing reporting them. The test runner converts TypeScript without checking it, and the production build checks only the code that actually ships; test files fall between the two, so neither looked, and six releases went out green over the top of them.

The three are fixed, and &mdash; the substantive part &mdash; a type-checking step now runs as part of the release gate, so the next three cannot arrive the same way. Fixing the errors alone would have removed the instance and left the cause.

The gap was confirmed rather than assumed. A deliberate type error was planted in a test file: the production build passes it without comment, and the new step catches it and names the line. That is why the step exists, and the record of it now sits in the gate&rsquo;s own configuration, where a later reader might otherwise remove the step as duplicating the build.

All three errors were the same kind &mdash; iterating a pattern match or a lookup table in a form the project&rsquo;s TypeScript settings disallow &mdash; and are rewritten using the form the project already uses elsewhere for exactly this reason. Those settings are deliberately left alone: loosening them would have silenced this class of error across the whole codebase rather than fixing the three at hand.

## Version 0.28.1 (2026-08-17)
### Maintenance: the test-coverage instrument is now actually installed

Internal tooling only &mdash; nothing about the app changes. The tool that measures how much of the code the test suite exercises, `@vitest/coverage-v8`, was named in the lockfile only as an optional companion of the test runner and had no install entry of its own. A clean checkout therefore never installed it, and `npm` would remove it if it were installed by other means, so coverage could not be measured from a fresh clone &mdash; the run failed outright with a missing-dependency error. It is now declared as a development dependency in its own right.

The version is pinned exactly (4.1.5) rather than given a range, because the package requires an exact match with the installed test runner; a range would describe something that cannot in fact be installed. Nothing else was added: no new script and no new configuration, matching how the other apps in the suite invoke coverage on demand. All 1323 tests pass, and lint, type-check and the production build are clean.

## Version 0.28.0 (2026-08-12)
### Added: you can choose the date the &ldquo;today&rdquo; line is drawn at

The vertical line marking today has always been drawn at whatever date it actually is. That works when a chart is presented the day it is made. It does not work for the common case: a chart prepared several days before the sprint review it will be shown at, where the line ought to sit on the review date rather than on the day the work was done.

Chart Settings now has a date box beside the **Show Today&rsquo;s Date** toggle. Leave it empty and nothing changes &mdash; the line is drawn at today, exactly as before. Put a date in it and the line moves there, correctly positioned against the timeline, with that date printed above it. The idea is a standard one; other planning tools call it the status date, and project-management practice calls it the data date.

**Date Prepared is deliberately untouched.** It continues to report the real date the chart was made. The two are separate on purpose: one says when the chart was drawn, the other says what point in the plan it is describing.

**The legend stops calling it today when it isn&rsquo;t.** With a date chosen, the legend entry reads &ldquo;Status Date&rdquo; instead of &ldquo;Today&rsquo;s Date&rdquo;. Without that, a chart handed to someone else would show a date a week in the future labelled as today, sitting next to a Date Prepared showing the real date &mdash; a chart that contradicts itself in front of the people it is meant to convince. With no date chosen the legend reads &ldquo;Today&rsquo;s Date&rdquo; as it always has.

**A date the chart cannot show now says so.** The line is only drawn if the date falls inside the span the chart covers, which has always been true of today as well. A date the user typed on purpose vanishing without explanation reads as a broken feature, so a note now appears under the setting explaining that the date sits outside the chart&rsquo;s range and no line will be drawn. A date outside the years the app accepts is refused the same way rather than being silently ignored.

**Snapshots freeze the date they were taken with.** A saved snapshot keeps its own status date and goes on drawing the line where it was when the plan was captured, no matter what date is chosen later. Snapshots saved before this release, and any saved without a status date, continue to draw at the real current date &mdash; they do not inherit a date chosen afterwards. A historical record that quietly rewrote itself every time the setting changed would be worth nothing.

The setting is per user, not per project, and is saved in both local and cloud storage as well as through export and import. In cloud mode it syncs like every other chart setting.

### Fixed: clearing every custom legend label now actually clears them

Separate, older bug found while building the above. The five legend labels under Settings &rarr; Default Legend Labels can be renamed, and emptying a box is meant to restore that label&rsquo;s default. Emptying **all five** did not work: the old names were written straight back over the top and reappeared on the next reload. Clearing some but not all was unaffected, so the failure only showed up for anyone trying to reset the lot.

The cause was a saving rule that could add a setting but never remove one &mdash; when nothing was left to save, the previous values were kept instead of being dropped. The status-date setting added in this release would have had exactly the same flaw, which is how the older one came to light. Both now clear properly.

This dates from v16.2 (April 2026). The two other settings saved the same way &mdash; the work week and the export attribution &mdash; were checked and cannot be emptied through the app, so neither was affected.

## Version 0.27.21 (2026-08-04)
### Fixed: the page carries its name before the app finishes loading

The site hands the browser a nearly empty page first and fills it in once the app starts. That first page had no title on it. Until the app finished loading, the browser tab showed the web address rather than a name &mdash; and anything that reads a page without running it found nothing to go on at all: search engines, link previews, a screen reader announcing the page, and the monitoring that checks whether the site is still up.

A title had in fact been written &mdash; along with the page description and the tab icon &mdash; but in a place that never got the chance to run. The app hides itself until it knows whether to draw in light or dark mode, so the page does not flash white on a dark screen. Everything behind that curtain was skipped when the first page was built, the title included. It appeared only once the app was already running, which is precisely when it was no longer needed.

The title, description and tab icon now sit outside that curtain and ship with the first page. The tab reads &ldquo;GanttApp&trade; &mdash; Split-bar Gantt charts for visualizing release uncertainty&rdquo; straight away, matching how the other SPERT® Suite apps name themselves. The version number that used to sit in the tab is gone; it remains in the footer and on the Change Log tab, and keeping it out means the tab name no longer changes on every release &mdash; so uptime monitoring can watch for a name that stays put.

A check now guards this. It was deliberately broken twice before being trusted: the title was moved back behind the curtain, and separately its wording was altered, and the check was confirmed to fail in both cases.

## Version 0.27.20 (2026-08-02)
### Changed: the licence gains two conditions, and one that asked too much was rewritten

Licensing only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.19.

`LICENSE` remains a byte-for-byte copy of the canonical file in the SPERT® Suite landing-page repository, differing only in the project repository URL on line 4. It goes from 726 lines to 756. What the licence permits is unchanged: anyone may still use, study, modify and share this software freely. What changed is the set of conditions attached to it, which now number six rather than four, and each now follows the wording of the standard licence itself rather than paraphrasing it. That matters more than it sounds &mdash; the standard licence lets whoever receives the software delete any added condition that strays outside the short list it allows, so a condition worded too ambitiously protects nothing at all.

Two conditions are new. The first says the author's name may not be used to endorse or promote a product built from this software without permission. Nothing else in the licence covered this: the project's trademarks are protected whether the licence mentions them or not, but a personal name has no such protection, and another condition requires that name to stay in the source code. The second applies to anyone who resells this software with a warranty or support contract of their own &mdash; if those promises create a liability that lands on the original author, the reseller has to cover it.

One condition was rewritten. The one covering on-screen credit used to require any modified version with a user interface to display a notice. The standard licence permits requiring that existing notices be preserved, not that new ones be created, and it says elsewhere in as many words that a modified work need not add such notices where the original had none. The condition now requires that where a modified version already shows legal notices, the original author's name is kept among them.

Two smaller changes: a modified version may no longer misrepresent where this software came from, and the trademark condition now says plainly that naming this project in order to describe honestly what a fork was derived from is not itself prohibited, provided it does not suggest this project endorses the result.

## Version 0.27.19 (2026-07-31)
### Changed: the release checks now cover all three copies of this changelog

Tooling only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.18.

The release checks could only ever be told about **one** changelog file, so the other copies this project keeps were invisible to them. There are three: this file, the served copy under `public/`, and the version history built into the app itself. A release could pass every check while two of the three were left behind &mdash; which is exactly how seventeen versions went missing from this file before v0.27.16 and v0.27.17 transcribed them back.

All three are now checked on every release. The served copy must match this file byte for byte, and the in-app history must carry an entry for the version being shipped.

Each new check was deliberately broken before being trusted: a copy was altered, an entry was removed, and a file was deleted, and the checks were confirmed to fail in each case.

## Version 0.27.18 (2026-07-31)
### Changed: the release checks now read this repository's own Node version

Tooling only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.17.

The automated release checks were told to run on &ldquo;Node 24&rdquo;, written directly into the workflow file. That is not the same thing as the version this repository pins: it resolves to whichever 24.x release the build service happens to have on hand, and the pin recorded alongside the source was never consulted. The workflow now reads that file instead, so the version is stated in exactly one place.

The version actually selected is unchanged today, because the pin here names a major line rather than an exact release &mdash; that is deliberate, so each build picks up the newest secure patch in the line. What changes is that a companion repository which holds back from the newest Node release on purpose &mdash; avoiding a fault that breaks server-rendered pages &mdash; will have that instruction honoured once it gains the same checks, instead of silently overridden.

## Version 0.27.17 (2026-07-31)
### Changed: changelog backfill complete &mdash; the suite-wide backlog is closed

Record-keeping only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.16.

**This file and the in-app changelog now hold the same 104 versions, in the same order, which has never been true before.** v0.27.16 took the four plain-text entries; this release closes the remaining thirteen &mdash; v11.1, v11.2, v11.3, v12.0 through v12.6, v13.8, v13.9 and v0.22.0 &mdash; whose items are JSX rather than strings, so they had to be converted rather than copied. 55 bullets in total.

The conversion was not done by pattern-matching the source text. The `.tsx` was transpiled with a custom JSX factory and the resulting element tree walked, turning `<strong>` into `**`, `<code>` into backticks and `<em>` into `*`, with any other tag raising an error rather than being silently dropped &mdash; only those three occur. HTML entities needed no table of their own: the JSX transform decodes them, so `&mdash;`, `&hellip;`, `&rarr;`, `&ldquo;`/`&rdquo;` and the numeric forms such as `&#123;` arrive as real characters. The result was then cross-checked against React's own renderer &mdash; every item rendered to static markup, tags stripped, and compared to the markdown with its formatting removed. All 59 items matched exactly.

Two conversions applied throughout, as in v0.27.16: dates from `Month D, YYYY` to ISO, and placement taken from the data file's array order rather than from sorting, because this project's version numbers are **not** monotonic &mdash; the history runs 1.0 → 18.0.0 and then renumbers down to the 0.20.x era.

One deliberate omission. Entries in v0.22.0's era carry a `### Category: title` line that summarises the release, and the in-app data has no such title. Rather than invent one, v0.22.0 is transcribed as a bare bullet list. It does get the `---` rule its era uses, since that is a formatting convention rather than content. The result is honest about what the source actually contains.

`KNOWN_MISSING_FROM_MARKDOWN` goes to zero. **It is kept at zero length rather than deleted, along with the two tests that read it**, because emptied they assert strictly more than they did while it held names: "opens no NEW gap" becomes an every-version-is-in-both check with no exemptions available, and the ratchet beside it becomes a guard against anyone reintroducing one. Deleting the list would mean deleting both, and the next release that forgot an entry would land unnoticed. Both directions were re-verified by mutation after emptying, along with the `public/CHANGELOG.md` byte-identity guard.

**That closes the backlog across the whole suite.** SPERT AHP had one missing version and closed it in v0.18.16; MyScrumBudget had 21 and reached zero in v0.34.6; SPERT Scheduler had 33 and reached zero in v0.59.6; GanttApp had 17 and was the last. 71 versions in total, none of them ever lost &mdash; users had always seen them in-app &mdash; but none of them written down where the repository keeps its own record.

### Changed
- Backfilled v0.22.0, v13.9, v13.8, v12.6 – v12.0 and v11.3 – v11.1 into `CHANGELOG.md`, converted from the in-app JSX, and re-synced `public/CHANGELOG.md`.
- Emptied `KNOWN_MISSING_FROM_MARKDOWN` in `src/lib/__tests__/changelog-surfaces.test.ts`, keeping the list and both ratchet tests in place, and typed it `string[]` so the empty literal does not infer `never[]`.

## Version 0.27.16 (2026-07-31)
### Changed: backfilled the four plain-text versions missing from this file

Record-keeping only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.15.

**v3.1 through v3.4 have always rendered in the app and were never written into this file.** They are the four entries in the backlog whose items are plain strings rather than JSX, so they transcribe directly. All four are now in place above v3.0, matching the bare-bullet shape that every other entry of that era uses &mdash; no `###` heading, no `---` rule, one blank line between entries.

Two conversions were needed even for these. This file's headings are ISO dates (`## Version X.Y (YYYY-MM-DD)`) while `changelog-data.tsx` stores `Month D, YYYY`, so the dates are converted rather than copied. And GanttApp's version numbers are **not** monotonic &mdash; the history runs 1.0 → 18.0.0 and then renumbers *down* to the 0.20.x era &mdash; so placement is taken from the data file's array order and asserted against it before writing, never from sorting.

The recorded gap falls from 17 versions to 13. What remains is the harder half: every one of them stores its items as JSX, so backfilling means converting `<strong>`, `<code>` and `<em>` plus a range of HTML entities into markdown. That is a different kind of work and is left to the next release.

**GanttApp is the last repository in the suite still carrying this.** SPERT AHP closed its single missing version in v0.18.16, MyScrumBudget 21 of them in v0.34.6, and SPERT Scheduler 33 in v0.59.6.

### Changed
- Backfilled v3.1, v3.2, v3.3 and v3.4 into `CHANGELOG.md`, transcribed verbatim from the in-app changelog data, and re-synced `public/CHANGELOG.md`.
- Lowered `KNOWN_MISSING_FROM_MARKDOWN` in `src/lib/__tests__/changelog-surfaces.test.ts` from 17 entries to 13, as the ratchet requires, and recorded there that a malformed backfilled heading fails **silently** while a version remains on that list &mdash; the entry sits in the file uncounted and every assertion still passes.
- Corrected that guard's header comment, which claimed 101 in-app and 84 markdown entries; both were off by one, having been written before the release that shipped them.

## Version 0.27.15 (2026-07-30)
### Changed: a release gate, and a changelog test that no longer needs hand-maintenance

Release-process hardening &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.14.

**A test that had to be edited on every release no longer does.** `ChangelogTab.test.tsx` asserted `versionTexts[0]` through `versionTexts[27]` against hardcoded version strings, and its own comment said the list "must be shifted by one on every release". Adding a changelog entry failed the suite until someone renumbered 28 assertions by hand. It is now expressed as the property those assertions were approximating: the component renders exactly one heading per entry, in the data's order. That needs no maintenance and is strictly stronger &mdash; it covers all 101 entries rather than the first 28 and the last one. Verified by making the component silently truncate its list and confirming the new assertion catches it.

This repository was the only one in the suite that proved its newest changelog entry actually renders. That property is preserved &mdash; it just no longer costs a manual edit per release.

**`CHANGELOG.md` is missing 17 versions the app has always rendered.** The in-app changelog carries 101 entries; this file carries 84. The gap is old and predates the gate; backfilling it means transcribing JSX into markdown, which is separate work. Rather than leave it unmeasured, the missing versions are now recorded explicitly and guarded in both directions: no **new** gap can open, and once a version is backfilled it must be removed from the recorded list, so the debt can only shrink. Both directions were verified before being trusted.

**The gate also caught this file's own staleness risk.** `CLAUDE.md` previously sat at version 0.21.1 and "May 5, 2026" while the repository was at 0.27.13 &mdash; thirteen releases stale. It is gitignored, which is exactly why it drifted: the release checklist's consistency `grep` filters gitignored files out, making version drift inside it structurally invisible. The gate reads the file directly and fails if the `Current Version` lines disagree with `package.json`.

### Added
- **`npm run shipgate` &mdash; the release gate.** Verifies that `package.json`, both version fields in `package-lock.json`, `APP_VERSION` and the newest `CHANGELOG.md` entry agree, checks `CLAUDE.md` for a stale version declaration, then runs lint, the tests and a production build. It reports every disagreement in one run rather than stopping at the first.
- **Continuous integration** (`.github/workflows/shipgate.yml`), running the same `npm run shipgate` on every pull request and push to `main`, so the local gate and the automated one cannot drift apart. This is the first CI this repository has ever had &mdash; until now a green check meant Vercel had built a preview, not that the 1,250 tests had run, because nothing ran them.
- **A guard that the three changelog surfaces agree** &mdash; `changelog-data.tsx` (what the app renders), `CHANGELOG.md` (the repository record), and `public/CHANGELOG.md` (served on the deployed site, and read by nothing, so it can rot unnoticed).
- **A guard that `LICENSE` matches the canonical suite licence** &mdash; one SHA-256 of the licence body, normalised for the repository URL on line 4. This repository had the worst drift of the nine before v0.27.14, shipping 48 lines with none of the operative licence.
- **A guard that every static asset linked from source exists in `public/`** &mdash; the Quick Reference Guide PDF, the favicons, and the served changelog.

## Version 0.27.14 (2026-07-29)
### Changed: the license now ships the full GPL and reserves the SPERT&reg; brand

Licensing only &mdash; no functional, data, or interface changes. The app behaves identically to v0.27.13.

**This repository was not shipping the GNU GPL v3.** `LICENSE` was 48 lines: the standard "this program is free software" notice, then `Full license text: https://www.gnu.org/licenses/gpl-3.0.en.html`, then a contact line. The operative licence &mdash; all of Sections 0 through 17, including the conditions on conveying modified source, the patent grant and the warranty disclaimer, together with the entire preamble &mdash; was not in the file at all. GPL v3 Section 4 requires that you "give all recipients a copy of this License along with the Program", and a hyperlink is a weak substitute for that. The file is now the complete 726-line licence: 707 insertions against 29 deletions, the largest of the nine repairs in this suite-wide pass.

**The license also now reserves the brand.** It has always required that the original author attribution be preserved, but it said nothing at all about the brand, which left room to read the GPL's redistribute-and-modify freedom as carrying the *name* along with the code. That was never the intent. A new **Trademark Reservation** clause under GPL v3 &sect;7(e) names "SPERT", "Statistical PERT" and "Estimation Made Easy" as trademarks registered with the USPTO, and "GanttApp" and "MyScrumBudget" as unregistered common-law marks, and grants no right to use any of them &mdash; whether alone, in combination with other words such as "SPERT Suite", or as a logo. A companion **Marking of Modified Versions** clause under GPL v3 &sect;7(c) requires any fork to adopt a name that cannot reasonably be confused with those marks. Between them the two clauses draw the line the licence always meant to draw: the code is free to take, change and redistribute, the author attribution has to travel with it, and the brand stays behind.

Both clauses fall inside the categories GPL v3 Section 7 permits, which matters &mdash; Section 7's closing paragraph lets a recipient strip any additional term falling *outside* that list, as a "further restriction". The section header and its opening sentence now cite Section 7 rather than Section 7(b), because the terms draw on 7(b) for attribution, 7(c) for renaming modified versions and 7(e) for the trademark reservation.

**The additional terms were also an older, weaker wording.** This repository still carried the original numbered `1.`/`2.` form of the attribution and UI-notice terms, predating the lettered `a)`/`b)` rewrite. The older wording omitted two things of substance: the prohibition on removing, obscuring or *replacing* the author attribution with another name, and the requirement that the user-interface notice appear in a visible and accessible location with a link to the original repository where feasible. Both are now present.

Line 1 already read "SPERT&reg; Suite" correctly here, so no brand-name correction was needed &mdash; unlike five of the sibling repositories, which still carried the retired "Statistical PERT&reg; Software Suite" name.

`LICENSE` is now a byte-for-byte copy of the canonical file in the SPERT&reg; Suite landing-page repository, which is its single source of truth, differing only in the project repository URL on line 4. Of the nine suite repositories audited, only MyScrumBudget was an exact copy beforehand.

## Version 0.27.13 (2026-07-29)
### Fixed: member list showed a raw Auth UID

`getProjectMembers` resolved member profiles against `ganttapp_profiles` only. That document is written by `writeUserProfile` in `AuthContext` on **this** app's sign-in, whereas the cross-app invitation Cloud Function resolves an invitee **by** their `spertsuite_profiles` document and then writes only `members.{uid}` &mdash; it never seeds a per-app profile. Anyone who had used another SPERT&reg; app but never signed into GanttApp therefore had no per-app profile, and `ShareDialog` rendered `member.email || member.uid`: a raw 28-character Firebase Auth UID.

The lookup now falls back to `spertsuite_profiles/{uid}` when the per-app document is absent. Both are written with the same payload, and `firestore.rules` already permits `get` on the suite mirror for any authenticated user, so no rules change and no data backfill were needed &mdash; affected members render correctly on next load. Strictly a fallback: the per-app document still wins, and the mirror is not read when it is present.

Guarded by three new cases in `src/shared/storage/__tests__/firestore-sharing.test.ts`; two fail with the fix reverted. Suite-wide defect rather than a GanttApp quirk &mdash; first found in SPERT Story Map v0.49.3.

## Version 0.27.12 (2026-07-25)
### Dependency security: postcss override floor → ^8.5.18

Shipped-side security fix. The `postcss` override floor moves `^8.5.10` → `^8.5.18` (resolving to 8.5.23), clearing GHSA-r28c-9q8g-f849 — PostCSS path traversal in previous-source-map auto-loading (`sourceMappingURL`) leading to arbitrary `.map` file disclosure, high severity, affecting `postcss <=8.5.17`. This was the only advisory reaching the production bundle; `next` was flagged solely for depending on the vulnerable `postcss`, so the single floor bump clears both entries. The caret range already admitted the fixed version — the floor bump documents the security boundary and prevents regression, matching the `protobufjs ^7.6.5` and `sharp ^0.35.0` overrides added in v0.27.9. Note: npm's suggested `audit fix --force` for this advisory proposes `next@9.3.3`, a seven-major downgrade, which is rejected. Shipped-side audit (`npm audit --omit=dev`) returns to 0 vulnerabilities. All 1247 tests pass; production build, lint, and type-check are clean.

## Version 0.27.11 (2026-07-23)
### Maintenance: jsdom 29.0.2 → 29.1.1

Routine dependency update, past the 60-day soak window (jsdom 29.1.1 published 2026-04-30, ~84 days ago). jsdom is the test environment only (vitest `environment: 'jsdom'`) — not in the production bundle. All 1247 tests pass under jsdom 29.1.1; production build, lint, and type-check are clean. No app behavior changes.

## Version 0.27.10 (2026-07-23)
### Dependency security: firebase-tools 15.24.0 + transitive audit-fix sweep

Dev-tooling security cleanup — no shipped-bundle impact. `firebase-tools` bumps 15.22.1 → 15.24.0 (dev-only CLI). A non-force `npm audit fix` sweep then clears the transitive advisories that resolve in range: the critical `tar` and the high-severity `brace-expansion`, `js-yaml`, and `fast-uri`, plus the low `body-parser` — total advisories drop 13 → 8. The 8 that remain are all dev-only with no forward fix: the `firebase-tools` OpenTelemetry / @google-cloud/pubsub / gaxios / uuid / @hono / MCP-SDK cluster (7 moderate; npm's only "fix" is a breaking downgrade to firebase-tools 14.23.0, which we reject) and `esbuild` (1 low; a Windows-only dev-server file read, not applicable on macOS/CI). None are in the production bundle (`npm audit --omit=dev`: 0 vulnerabilities). All 1247 tests pass; production build, lint, and type-check are clean.

## Version 0.27.9 (2026-07-23)
### Dependency security: next 16.2.11 + sharp/protobufjs overrides

Shipped-side security update clearing the production-tree CVE cluster flagged by the SPERT devops dashboard. `next` bumps 16.2.9 → 16.2.11 (high-severity advisory cluster led by GHSA-6gpp-xcg3-4w24; 16.2.11 is the latest fixed patch), with `eslint-config-next` co-bumped to 16.2.11 to stay lockstep. The `protobufjs` override floor moves `^7.6.3` → `^7.6.5`, clearing GHSA-j3f2-48v5-ccww (protobufjs DoS via infinite loop in `.proto` option parsing) on the copy carried by the Firebase SDK. A new `sharp` override pins `^0.35.0` (resolving to 0.35.3), clearing the inherited libvips CVE cluster (GHSA-f88m-g3jw-g9cj) — `next@16.2.11` still declares `sharp: ^0.34.5`, so the framework bump alone does not lift it; sharp is an unused optional dependency here (no `next/image`; Vercel performs image optimization at the platform layer). The flagged `next` advisories are not structurally reachable in this app (Pages Router, no `next/image`, no middleware, no Server Actions); the bump is taken for currency and a clean scan. All 1247 tests pass. Production build, lint, and type-check are clean.

## Version 0.27.8 (2026-07-04)
### Releases tab: chronological date order (Start, Early, Most Likely, Late)

The Most Likely date input moved between Early Finish and Late Finish in the Add/Edit release form, so the fields read chronologically left-to-right and match the chart, where the Most Likely line renders between the early and late boundaries. The form label now spells out *(Optional)* instead of *(Opt.)*. Saved release rows show the same order — Start, Early, Most Likely, Late — with the former "ML:" abbreviation spelled out as "Most Likely:". Position now encodes chronology while the asterisk/label markers continue to encode required vs. optional. No data-model, validation, or chart changes.

## Version 0.27.7 (2026-06-28)
### Standardize the postcss override to a caret range (^8.5.10)

Aligns the `postcss` override with the rest of the SPERT suite: `8.5.10` → `^8.5.10`. This floats the single hoisted copy from `postcss@8.5.10` to `8.5.16`, keeping GHSA-qx2v-qp2m-jg93 (PostCSS XSS via unescaped `</style>`, moderate / CVSS 6.1, `postcss <8.5.10`) closed while allowing future 8.5.x patch uptake. Build, lint, and all tests pass. No app behavior, data-model, or runtime changes.

## Version 0.27.6 (2026-06-25)
### Adopt Node 24 LTS: @types/node 22→24, engines.node 24.x, .nvmrc 24

Moves the project to Node 24 LTS. `@types/node` bumps from 22.19.15 to 24.12.2 (Node 24 LTS type definitions, 83 days soaked); `engines.node` advances from `22.x` to `24.x` and `.nvmrc` from `22` to `24`, matching the Vercel project's Node 24 build/runtime setting. All dependencies support Node 24 (firebase-tools, vitest, and jsdom declare `>=24` explicitly). The type definitions now match the runtime rather than running ahead of it. Build, lint, type-check, and all 1245 tests pass. Next `@types/node` bump: 26.x once Node 26 LTS clears the 60-day soak (~December 2026).

## Version 0.27.5 (2026-06-25)
### jsdom 27.4.0 → 29.0.2

jsdom two-major upgrade (29.0.2, 79 days soaked). Test environment only (vitest `environment: 'jsdom'`) — not in the production bundle. jsdom 29 introduces undici 6.27.0 as a new transitive dependency. All 1245 tests pass under jsdom 29; build, lint, and type-check clean.

## Version 0.27.4 (2026-06-25)
### TypeScript 5.9.3 → 6.0.3

TypeScript major upgrade (6.0.3, 69 days soaked). Dev-time type checker only — SWC compiles the production bundle, so there is no runtime impact. TypeScript 6.0 deprecates the `target: "es5"` compiler option (fully removed in 7.0); the project's intentional es5 target is retained via a new `"ignoreDeprecations": "6.0"` opt-in in tsconfig.json. @typescript-eslint resolves to 8.62.0 (peer `>=4.8.4 <6.1.0`), which admits 6.0.3 — no override needed. Build, lint, type-check, and all 1245 tests pass.

## Version 0.27.3 (2026-06-25)
### react/react-dom 19.2.4 → 19.2.5

React patch update (19.2.5, 77 days past publish — well past the 60-day soak window). react and react-dom move together as an atomic pair; @types/react and @types/react-dom are held at their current versions. No source changes. Production build, lint, type-check, and all 1245 tests pass.

## Version 0.27.2 (2026-06-25)
### Dependency security: next 16.2.9 + vite 7.3.5 + firebase 12.12.1 + firebase-tools 15.22.1

Security-focused dependency update clearing the CVE cluster flagged by the SPERT devops dashboard. next bumps from 16.1.6 to 16.2.9 (high-severity cluster; real fix floor 16.2.6 from GHSA-26hh-7cqf-hhc6; 16.2.9 is latest fixed). The vite override moves from 7.3.2 to 7.3.5, clearing GHSA-v6wh-96g9-6wx3 and GHSA-fx2h-pf6j-xcff (both Windows-only dev-server issues). A postcss override forces deduplication of next's exact-pinned 8.4.31 to the patched 8.5.10. firebase advances to 12.12.1 (65d old, past soak window), clearing the protobufjs critical advisory via transitive float; @grpc/grpc-js high advisories expected to clear via float. firebase-tools advances to 15.22.1 (CVE: GHSA-h67p-54hq-rp68). A protobufjs ^7.6.3 override adds a defensive floor. eslint-config-next co-bumps to 16.2.9. vitest advances to 4.1.5. All 1245 tests pass. Production build, lint, and type-check are clean.

## Version 0.27.1 (2026-06-19)
### Dependency security: vitest 4.1.4 + vite 7.3.2 (transitively pinned via overrides)

Targeted dev-dependency security update closing four CVEs flagged by the SPERT Story Map v0.46.2 audit. vitest and vite are test tooling only — they never ship to production — so there is zero runtime, app-behavior, or user-facing change. All 1245 tests pass on vitest 4.1.4; production build and lint are clean. Node.js stays pinned at v22 LTS.

#### CVEs closed

- **vitest 4.0.18 → 4.1.4** closes GHSA-5xrq-8626-4rwp (Critical) — Vitest UI server arbitrary file read and execute.
- **vite 7.3.1 → 7.3.2** closes GHSA-p9ff-h696-f583 (High) arbitrary file read via the dev-server WebSocket, GHSA-v2wj-q39q-566r (High) `server.fs.deny` bypass via queries, and GHSA-4w7w-66w2-5vf9 (Moderate) path traversal in optimized-deps `.map` handling.

#### Mechanism

- vite is transitive (pulled by vitest and `@vitejs/plugin-react`), not a direct dependency. Bumping vitest to 4.1.4 did not move vite on its own: vitest@4.1.4 declares a wide `^6.0.0 || ^7.0.0 || ^8.0.0` vite range that the locked 7.3.1 already satisfied, and the current vite `latest` dist-tag is 8.x, so normal resolution would never select 7.3.2. vite is therefore pinned to exactly 7.3.2 through a package.json `overrides` entry, which forces the patched build across the whole tree while keeping vite out of `dependencies` and `devDependencies`.

#### Deferred (intentional)

- vite GHSA-fx2h-pf6j-xcff and GHSA-v6wh-96g9-6wx3 remain open. Both are Windows-only and are first fixed in vite 7.3.5, which has not yet cleared the 60-day stability window; the bump is scheduled as a follow-up around 2026-07-31. At that point the `overrides` pin moves from 7.3.2 to 7.3.5 and the remaining vite advisory node clears entirely. The pre-existing `protobufjs` advisories (via firebase, production tree) are unrelated to this update and out of scope.

## Version 0.27.0 (2026-05-25)
### Cloud storage hardening: sign-out cleanup, sentinel guard, I2/I1a eviction, buffered inputs

Nine cloud storage correctness gaps closed across the sign-out chain, the real-time subscription path, and the eight global settings inputs that previously wrote on every keystroke.

#### Critical / High

- **E1/F1/F3:** Externally-revoked sessions (`onAuthStateChanged(null)`) now run the full sign-out cleanup chain instead of leaving the cloud service alive and the previous user's data in memory. The `!firebaseUser` and `!db` branches are split: only true revocation runs cleanup. On cloud sign-out, `ganttAppData` and `ganttAppSnapshots` are cleared from `localStorage`, closing the shared-browser path where a next user's cloud-mode switch could have uploaded the previous user's data into their Firestore account.
- **I1:** Real-time releases data-loss guard now fires only on the first snapshot per project per cloud session. A `Set<string>` sentinel at `AppDataProvider` scope tracks seen projects; mutation outside the `setData` updater for React StrictMode correctness. Legitimate collaborator deletions now propagate.
- **I2:** `permission-denied` on a real-time subscription prunes driver `lastSavedState` and `pendingData` (preventing an infinite save-fail loop), evicts project + releases from `AppDataContext`, and evicts snapshots from `useSnapshots`.
- **A3:** Eight text inputs (Prepared By, five Default Legend Labels, Export Attribution name + identifier) commit on blur, Enter, Escape (reverts), or unmount via the new `useBufferedField` shared hook. Inline chart label editors deferred (per-project collaboration semantics).
- **I1a:** User-switch race guard added to `subscribeToProject`, `loadAppData`, `loadSnapshots`, and `executeSave` (closes the save-side infinite-loop scenario).
- **D1:** Save debounce reduced from 500ms to 200ms.
- **D2:** `pagehide` listener added alongside `beforeunload` for bfcache-aware flushing.

#### Medium

- **J1/J2:** `loading` resets to `true` at the start of each storage load cycle, closing a race where the import fast-path gate (`!appDataLoading`) was sticky-false during invitation-claim reloads.

#### Low

- **K2:** `schemaVersion: 1` included in every Firestore user-settings write; read-side migration hook added.

Tests: 1220 → 1245.

## Version 0.26.1 (2026-05-24)
### About page polish — QRG button label standardized across the SPERT® Suite

Renames the About tab QRG download button from `Download Quick Reference Guide (PDF)` to `Open Quick Reference Guide (PDF)` so the label matches the canonical convention used across the SPERT® Suite (Forecaster, MyScrumBudget, AHP, Story Map, Scheduler). The PDF target is unchanged — `/GanttApp_Quick_Reference_Guide.pdf`, still opens in a new tab.

## Version 0.26.0 (2026-05-21)
### Import hardening + refactor: `useImportState` hook, cloud guard, collision-safe copy, ARIA

A full retrograde pass on Smart Import (v0.24.0). The cloud-mode hydration race that could silently create duplicate projects is closed, the ID-conflict default reverts from contextual "Replace" back to the safer "Skip" per spec pitfall #22, both apply functions become permanently lock-resistant, the state machine is extracted to a dedicated `useImportState()` hook, the copy path becomes collision-safe up to 99 iterations, and the preview UI gains real screen-reader support.

#### Bug fixes

**Cloud mode (CRITICAL) — fast-paths now gated on local storage mode.** Both import fast paths (`ganttapp-project-export` with zero conflicts; full-workspace replace into an empty workspace) now check `storage.mode === 'local'` before firing. Without this gate, the post-sign-in hydration window — where `listAppData()` may briefly return an empty snapshot before Firestore data arrives — let a fast path apply against an apparently-empty workspace, then silently duplicate every project once hydration completed. Cloud mode now always shows the preview, even for conflict-free imports. One extra click; zero data risk. (Spec pitfall #69.)

**Default decisions — ID conflicts default to Skip.** v0.24.0 used a smarter default: ID-conflict + matching names → 'Replace' (round-trip backup case); ID-conflict + different names → 'Skip'. The "matching names" rationale doesn't hold for the user who exported a backup, did three weeks of work, then accidentally imported the old backup — defaulting to 'Replace' would silently lose three weeks of work. All ID conflicts now default to 'Skip' unconditionally per spec pitfall #22. Users who actually want to replace must click 'Replace' explicitly.

**Copy collision (pitfall #84).** Importing the same file twice via 'copy' previously produced two projects both named "Foo (2)" — indistinguishable in the project list. The new copy path iterates suffix `(2)`, `(3)`, `(4)`, …, `(99)` against a `usedNames: Set<string>` of in-batch and existing project names, so the second copy of "Foo" produces "Foo (3)", the third produces "Foo (4)", and so on. Each chosen name is reserved before the next iteration. The suffix length is capped at 5 chars (" (99)") and truncation respects `MAX_NAME_LENGTH`.

#### Reliability

**Apply functions are now lock-resistant.** Both `applyMergeDecisions` and `applyReplaceAll` use `try/finally { applyingRef.current = false; setApplying(false); }`. The `applyingRef` (`useRef(false)`) is a same-tick reentrancy guard: refs are read synchronously at call time, so rapid double-clicks before React commits the `applying` state can't slip a second apply through. A belt-and-suspenders `if (applying) return` UI guard is added to `handleConfirmMerge` and `handleConfirmReplaceAll`. Net effect: the UI cannot be permanently locked by an unexpected throw, and a double-click on Confirm produces at most one import. (Spec pitfalls #27, #53.)

**File-read re-entrancy guard.** A `readerPendingRef` blocks a second `handleImport` invocation while the first reader is still in flight. The `<input type="file">` is also disabled immediately on first pick (`disabled={applying}`), so the visual + ref guards align. Closes a race where rapid picks could start two parsers and apply twice. (Spec pitfall #48.)

#### UX

**Stale banner + stale preview cleared at file-pick entry.** When a new file is picked, `setImportBanner(null)` and `setImportPreview(null)` run before any processing. Previously, an AlertDialog from a prior failed pick (or a preview from an abandoned pick) could render over the new flow until parsing completed. (Spec pitfall #79.)

#### Refactor

**`useImportState()` hook (pitfall #59).** Created at `src/features/projects/hooks/useImportState.ts`. The hook owns all import state (`importPreview`, `importBanner`, `replaceAllPending`, `applying`, `fileInputRef`, `readerPendingRef`, `applyingRef`) and all handlers (`handleImport`, `handleConfirmMerge`, `handleConfirmReplaceAll`, `handleImportCancel`, `onModeChange`, `onDecisionChange`, `openReplaceAllConfirm`, `cancelReplaceAllConfirm`). ProjectsTab becomes a thin shell that consumes the hook and renders the JSX. The import state machine is now isolated, testable via `renderHook`, and ProjectsTab's import-related logic drops from ~270 LOC to ~25 LOC of hook composition + JSX wiring.

**`applyImportDecisions` signature (pitfall #28).** Added `conflicts: ImportConflict[]` as the 5th positional parameter. Callers now compute conflicts once at preview-build time and pass the result through; the function no longer re-runs `detectImportConflicts` internally. Internal naming: `resolvedAction` renamed to `resolvedOutcome` to clarify that the return includes the synthetic `'added'` classification (pitfall #26).

**`normalizeProjectName(name)` shared helper.** Trim, lowercase, NFC normalization extracted from inline call sites in `detectImportConflicts`. Used internally; exported for future consumers.

#### Accessibility — `ImportPreviewSection.tsx`

- Outer container: `role="region"` with `aria-labelledby={headingId}` pointing at the "Review import" heading.
- Heading: programmatic focus on mount via `useEffect` + `useRef`, `tabIndex={-1}` to keep it out of the Tab cycle.
- Escape key dismisses the preview, suppressed while `applying === true` so an in-flight apply isn't cancelled.
- Per-conflict containers: `role="radiogroup"` with `aria-labelledby` pointing at the conflict description (existing→incoming for ID conflicts, just-incoming for name conflicts).
- Action buttons (Confirm Merge / Replace All Data / Cancel): `aria-busy={applying}` so assistive tech announces the apply state.

#### Tests

New `useImportState.test.ts` with 21 `renderHook` cases covering: parse errors, fast paths + cloud guard, preview/decision flow, drift abort, applying-state lifecycle (success + failure paths), same-tick reentrancy guards (split into ref-based + state-based), `readerPendingRef`, decision-state management (Map clone, mode toggle preserves decisions), `handleConfirmReplaceAll` flow + double-click guard, Cancel returns to preview state intact. Plus 4 new collision tests in `export.test.ts` (collision-safe copy iteration). Test count: 1197 → 1220 (+23).

#### SPEC_DEVIATIONS.md — Level 4 deferred items documented

A new `docs/SPEC_DEVIATIONS.md` tracks the gaps between GanttApp's import implementation and the canonical Level 4 spec:
- **SD-1** — React Context closure boundary; concurrent-add not caught (target v0.27.0).
- **SD-2** — `selectedProjectId` non-atomic remap (target: Zustand migration).
- **SD-3** — Copy collision-safe naming. **Resolved in v0.26.0.**
- **SD-4** — Default 'Replace' for ID-same-name conflicts. **Reverted in v0.26.0** per pitfall #22.
- **SD-5** — Coarse-grain abort vs per-decision graceful fallback (target v0.27.0).
- **SD-6** — `cloneProject` not reused in copy path due to owner semantics (future helper extraction).
- **SD-7** — `aria-busy` observability gap on Replace-All path; needs `flushSync` (deferred).

**Note (cloud mode):** The import success banner reflects the in-memory merge result. Firestore commit completes within ~500 ms via the debounced auto-save. Banner counts are optimistic in cloud mode — if a Firestore write later fails, the in-memory result has already been shown. Acceptable trade-off; matches pre-v0.24.0 behavior. (Spec pitfall #51.)

**Modified Files:**
- New: `src/features/projects/hooks/useImportState.ts` (~330 LOC)
- New: `src/features/projects/__tests__/useImportState.test.ts` (21 tests)
- New: `docs/SPEC_DEVIATIONS.md`
- `src/shared/utils/export.ts` — `normalizeProjectName` exported; `applyImportDecisions` signature change (conflicts param); `resolvedAction` → `resolvedOutcome`; collision-safe copy via `usedNames` Set; `COPY_SUFFIX` constant deleted
- `src/shared/utils/__tests__/export.test.ts` — 17 call sites updated; 2 tests migrated; 4 new tests added
- `src/features/projects/ProjectsTab.tsx` — 9 functions + state declarations replaced with single `useImportState()` hook call; JSX prop wiring updated
- `src/features/projects/ImportPreviewSection.tsx` — heading ref + focus-on-mount; Escape key handler; role="region"+aria-labelledby; role="radiogroup" per conflict; aria-busy on action buttons
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — "Smart ID-conflict defaults" test migrated to v0.26.0 contract (all ID conflicts default to 'skip')
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean (0 errors)
- Lint clean
- All 1220 tests pass
- Production build succeeds with Turbopack

---

## Version 0.25.0 (2026-05-10)
### UX: Releases tab right-side controls upgraded to the shared icon family

The per-release **Edit** and **Duplicate** text buttons on the Releases tab are replaced with the same icon button components used on the Projects tab — `PencilIconButton` (blue) and `CloneIconButton` (violet) — and the order is now **Edit, Duplicate (Clone), Delete**, matching the Projects tab. The existing `TrashIconButton` for Delete (already an icon since v17.1) stays put. A thin vertical divider sits to the left of the trio, separating the **Show** checkbox + **Status** dropdown (settings) from the icon actions.

**Why:** Visual consistency with the Projects tab. Once a user has seen the icons on Projects they immediately know what they do on Releases — the text buttons were redundant explanations after the first encounter. Tighter row, less visual noise, more horizontal space for the release name + dates.

**`PencilIconButton.active` prop (new).** The old Edit text button had a strong "this row is being edited" cue (solid blue background, white text, blue border) that stayed visible while the inline edit form was open. To preserve this affordance under the new icon, `PencilIconButton` gains an optional `active?: boolean` prop. When `true`, the button renders its hover state permanently (blue icon + blue tint background + blue ring) — the cue holds even when the cursor moves away. `disabled` overrides `active` (no visual on disabled buttons). Added by extending `isHoverActive` from `hover && !disabled` to `(hover || active) && !disabled`. Backwards-compatible: prop defaults to `false`, so all existing call sites (Projects tab edit pencil) are unchanged.

**Divider scope (Option A, agreed before coding).** On Projects, the divider separates a fixed-width share slot from the icons. On Releases there is no equivalent owner-only slot, so the divider sits directly to the left of the Edit icon and reads as **"settings | actions"** — separating Show + Status from the icon trio. No empty slot, no dead space. The divider markup matches Projects exactly: `1px × 20px`, `colors.border`, `margin: 0 4px`, `flexShrink: 0`, inside an inner flex container with `gap: '2px'` for tight icon spacing.

**Modified Files:**
- `src/shared/components/PencilIconButton.tsx` — new optional `active` prop; header bump to v0.25.0
- `src/shared/components/__tests__/PencilIconButton.test.tsx` — +2 tests for `active` (renders hover state at rest; disabled overrides active)
- `src/features/releases/ReleasesTab.tsx` — import `PencilIconButton` + `CloneIconButton`; replace Duplicate/Edit text buttons with icon buttons in Edit / Clone / Delete order; insert divider; wrap divider + 3 icons in inner flex `gap: '2px'`
- `src/features/releases/__tests__/ReleasesTab.test.tsx` — `getByText('Edit')` → `getByLabelText('Edit release')` (2 occurrences)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `ARCHITECTURE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass + 2 new (1195 → 1197 expected)
- Manual: hover any release row icon — Edit/Clone/Delete now render the same colored-tint background + matching colored ring as on Projects; click Edit → inline edit form opens AND the pencil stays blue (active state holds); click Cancel → pencil returns to gray

---

## Version 0.24.0 (2026-05-10)
### Smart Import with Per-Project Conflict Resolution

Replaces the prior binary import UX (replace-all confirmation OR additive merge-with-skip) with a per-project conflict resolution preview. The user picks a file, sees a full inline preview between the toolbar and the project list, makes per-project `skip` / `copy` / `replace` decisions on any conflicts, then confirms or cancels. The previous flow silently skipped any project whose ID matched an existing one — a surprise when round-tripping a backup with renames or hitting coincidental name collisions. The new flow surfaces every conflict and gives the user control.

**New utility surface in `src/shared/utils/export.ts`:**
- `ImportConflict` — `{ type: 'id' | 'name', incomingProject, existingProject }`. Emitted per conflicting incoming project.
- `ConflictAction` — `'skip' | 'copy' | 'replace'`.
- `ImportDecisionResult` — `{ added, skipped, copied, replaced, replacedIdMap }`.
- `detectImportConflicts(incoming, existing)` — first-insert-wins on name-map collisions preserves first-match semantics when two existing projects share a lowercased-trimmed name.
- `conflictsEqual(a, b)` — multiset equality on `(incomingId, type, existingId)` tuples; used by both stale-data guards.
- `applyImportDecisions(existing, incoming, existingSnapshots, decisions, idGenerator?)` — the replacement for `mergeImportedProjects`. Self-contained: recomputes conflicts internally so the caller does not pass them. Supports an optional deterministic `idGenerator` (defaults to `generateId`) for testability.

**Three-pass slot-preserving algorithm in `applyImportDecisions`:**
1. Pre-computation — iterate `incoming.appData.projects` in array order; build a `Map<existingSlotId, winningIncomingProject>`. **First-wins is determined by array order, not `decisions` Map insertion order.** Later replaces targeting a claimed slot are downgraded to `'skip'` and counted.
2. Slot substitution — iterate `existing.projects` in order; substitute incoming projects in place, copying `existingProject.owner` (or leaving undefined; never fabricated). Existing index is preserved, which avoids `executeFirestoreSave`'s `prevIndex !== index` reorder detection triggering spurious cloud writes.
3. Append — `'copy'` results, then `'added'` non-conflicting, both in incoming array order. New projects always land at the bottom of the workspace.

**Per-decision behavior:**
- `'skip'` (and the missing-key fallback for any conflict not in `decisions`) — omits the project, all its releases, and all its snapshots.
- `'copy'` — generates a new project ID via `idGenerator()`; truncates the name to `MAX_NAME_LENGTH - COPY_SUFFIX.length` and appends `COPY_SUFFIX = ' (2)'`. Releases get fresh IDs and the new `projectId`. Snapshots get a fresh `snapshot.id` and a new top-level `snapshot.projectId`; the embedded `snapshot.releases[]` array is left **entirely untouched** — it is a frozen historical record, and its embedded `projectId` values stay at the original (pre-copy) project ID. Confirmed safe: only `useEffectiveChartProps.ts` consumes `snapshot.releases` and only as a frozen render input — never joined against live `Project.id`. Owner is never set on copies.
- `'replace'` — slot-preserving; copies `existingProject.owner` onto the incoming record. ID conflicts produce no `replacedIdMap` entry (existing.id === incoming.id, no remap needed). Name conflicts produce `replacedIdMap.set(existingId, incomingId)` so the call site can rebind selection.

**Naming and cap divergences from `cloneProject` (intentional, documented inline):**
- `cloneProject` uses `" - Copy (1)"`, `" - Copy (2)"`, ..., `" - Copy (99)"`. Import-copy is unconditional `" (2)"` — accepts duplicate `"Foo (2)"` names silently.
- `cloneProject` enforces `MAX_SNAPSHOTS_TOTAL` and drops snapshots with an alert. `applyImportDecisions` bypasses the cap, consistent with the existing replace-all import path. Import is a bulk restore operation; the cap is intentionally bypassed.
- Snapshot dedup by ID applies only on the `'added'` path. `'replace'` does full slot substitution; no dedup needed.

**Workflow state machine in `ProjectsTab.tsx`:**
Three permitted state transitions, the only ways to move the import UI between states:
- `showPreview(state)` — clears banner, replaceAllPending, applying; sets preview.
- `showBanner(banner)` — clears preview, replaceAllPending, applying, file-input ref; shows banner.
- `clearImportFlow()` — clears preview and replaceAllPending; resets applying defensively (Cancel is disabled during apply, but the reset guarantees correctness if that disable is ever bypassed). Does NOT touch banner — preview and banner are mutually exclusive.

Banner dismiss is the only path that uses the raw setter directly, since dismissing a banner is not a flow transition.

**Two fast paths in `handleImport`:**
1. `ganttapp-project-export` with **zero conflicts** → applies immediately via `applyMergeDecisions`, no preview, success banner.
2. **Empty workspace** + replace-all-shape file (`ganttapp-all-projects` or `legacy`) AND `!appDataLoading` → applies via `applyReplaceAll`, no preview, no modal, success banner. The `!appDataLoading` gate prevents silent Replace-All against a workspace that is still loading.

All other imports show the inline preview between toolbar and project list (matching the v0.22.1 `InvitationSection` placement convention).

**Initial mode rationale per `_exportType`:**
- `ganttapp-project-export` → `'merge'` (single-project export has never had a replace-all path).
- `ganttapp-all-projects` → `'merge'` — intentionally new format introduced in v19.0; no established user habit to preserve; safe default; user can switch to Replace-All in one click.
- `legacy` → `'replace-all'` — every legacy file hits Replace-All today; defaulting to Merge would silently drop data for round-trip backup users who expect replacement.

**Smarter ID-conflict defaults** (populated synchronously inside `showPreview`, not via `useEffect`):
- `type: 'id'` AND lowercased-trimmed names match → `'replace'`. The dominant round-trip backup case: re-importing your own export. Eliminates the prior footgun where every round-tripped project was silently skipped.
- `type: 'id'` AND names differ → `'skip'`. Records have diverged (renamed locally or in the file); preserve the existing version.
- `type: 'name'` → `'copy'`. Coincidental name collision; keep both.

A `// TODO(v0.25.x)` flags adding a "select all → replace" affordance for the diverged-names case so round-trip users with renamed projects can replace in bulk.

**Dual stale-data guards:**
1. **Pre-async early-exit** in `handleConfirmMerge` — recomputes `detectImportConflicts(imported, data)` and compares against `importPreview.conflicts` via `conflictsEqual`. Catches the common non-cloud case cheaply, before any `await`.
2. **Authoritative post-`loadSnapshots` check** inside `applyMergeDecisions` — re-runs `detectImportConflicts` after the `await`, since that's where a real-time `onSnapshot` from cloud mode can fire and mutate `data`. `originalConflicts` is captured **before** `setApplying(true)` so the closure does not depend on stale `importPreview` state.

Both guards abort with the same banner text: `'The workspace changed while the preview was open. Please review your import again.'`. Fast Path 1 (no preview) gets a genericized variant: `'The workspace changed during import. Please try again.'`.

**Apply-state safety:**
- Confirm, Replace-All, Cancel, AND the mode selector are all `disabled` when `applying === true` inside `ImportPreviewSection`.
- Toolbar Import `<input type="file">` has `disabled={applying}`. Toolbar Import `<label>` has `aria-disabled={applying}` plus visual dimming. Both are required — `pointer-events: none` on the label is insufficient because keyboard activation can still fire the input.
- The Replace-All `ConfirmDialog` is gated on `replaceAllPending && importPreview !== null`, so it can never render without an active preview. On confirm, `imported` is captured before state mutation; `setReplaceAllPending(false)` runs synchronously so the modal disappears before the `await applyReplaceAll(imported)` begins.

**Preview UI per file type:**
- Green-tinted block lists non-conflicting projects with release counts and the line: *"New projects will be added at the bottom of your project list."*
- Amber-tinted block per conflict:
  - `type: 'id'` shows `Existing: "{name}" → Incoming: "{name}"` side-by-side, allowing the user to spot renames since export.
  - `type: 'name'` shows the incoming project name and the label `"Already exists — same name, different origin"`.
  - Three radio buttons with the labels: *"Keep existing, ignore imported"*, *"Add as a copy"*, *"Replace existing with imported"*.
- For `ganttapp-all-projects` and `legacy` files, a mode selector toggles between Merge and Replace All. Merge mode includes the hint: *"Workspace settings (colors, attribution) are not imported in Merge mode. Switch to Replace All to restore them."* Replace mode hides (not disables) the per-project conflict UI. Mode toggle does not reset per-project decisions.

**Banners:**
- Success banner uses `role="status"`, green tint, explicit Dismiss button, no auto-fade.
- Error banner uses `role="alert"`, red tint, explicit Dismiss button, no auto-fade.
- Error text is sanitized via `sanitizeFirebaseError` in catch paths. Specific strings: `'Invalid file format'` (parse failure), `'Error importing file'` (read failure).

**Radio id namespacing:** group `name="${idPrefix}-conflict-${incomingProject.id}"`; each radio `id="${idPrefix}-conflict-${incomingProject.id}-${action}"`; each `<label>` has matching `htmlFor`. `idPrefix` is derived from the parent `useId()` (`${baseFieldId}-import`). Tests verify pairing (shared `name` within group; `htmlFor`/`id` match) rather than exact `useId()` values, since `useId()` returns opaque strings like `:r5:`.

**Removed:**
- `mergeImportedProjects` from `export.ts` and its 9-test describe block.
- `applyImport`, `applyMergeImport`, `importConfirm`, `importMergeConfirm` from `ProjectsTab.tsx`.
- All `alert()` calls in the import flow (replaced by banners).

**Exports:**
- `MAX_NAME_LENGTH = 100` is now exported from `validation.ts` (was private). It is the generic max-name length used by `sanitizeString` as a default — applies to project names, release names, attribution, etc., not just projects. Consumed in `applyImportDecisions` to compute the truncation length.

**Modified Files:**
- `src/shared/utils/validation.ts` — export `MAX_NAME_LENGTH`
- `src/shared/utils/export.ts` — new types + `detectImportConflicts` + `conflictsEqual` + `applyImportDecisions`; `mergeImportedProjects` retired
- `src/features/projects/ImportPreviewSection.tsx` — new file (~270 LOC)
- `src/features/projects/ProjectsTab.tsx` — full import-flow rewrite as state machine; toolbar Import button gains apply-state disable
- `src/shared/utils/__tests__/export.test.ts` — `mergeImportedProjects` block removed; new tests for `detectImportConflicts` (6), `conflictsEqual` (6), `applyImportDecisions` (15)
- `src/features/projects/__tests__/ImportPreviewSection.test.tsx` — new file (14 tests)
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — old `import warning dialog` and `import routing by _exportType` blocks replaced with new Smart Import flow tests (10 tests across Fast Paths, preview rendering, modal gate, confirm/cancel, smart defaults, Replace-All reset, invalid file)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `CHANGELOG.md`, `ARCHITECTURE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All tests pass: 1195 total (was 1161 before v0.24.0; net +34)
- Manual: empty workspace + ganttapp-all-projects → applies immediately with banner; non-empty + project-export with no conflicts → applies immediately; mixed conflicts → preview between toolbar and list, defaults populated correctly, decisions togglable; Merge mode shows settings hint; Replace mode hides conflict list; Replace All Data → ConfirmDialog modal → confirm applies; pick new file mid-modal → modal dismissed; Cancel clears preview and file input; during apply, Import button + label dim and disabled

---

## Version 0.23.1 (2026-05-10)
### UX: matching colored hover ring on Trash / Pencil / Export / Clone icon buttons

Visual-consistency patch on top of v0.23.0. The new `ShareIconButton` introduced the soft colored ring pattern (cyan `box-shadow: 0 0 0 1.5px rgba(6,182,212,0.5)` on hover/focus) and the four pre-existing per-tile icon buttons looked subdued by comparison — only their tinted background appeared on hover, no ring. This release adds the matching ring to each of them, in their own brand color:

- **TrashIconButton** — red ring `rgba(239, 68, 68, 0.5)`
- **PencilIconButton** — blue ring `rgba(0, 112, 243, 0.5)`
- **ExportIconButton** — green ring `rgba(16, 185, 129, 0.5)`
- **CloneIconButton** — violet ring `rgba(139, 92, 246, 0.5)`

Each transition string was extended from `'background 0.12s ease'` to `'background 0.12s ease, box-shadow 0.12s ease'` so the ring fades in alongside the background tint rather than snapping in. The icon stroke color, hover background, and disabled handling are unchanged from v0.23.0. Header version annotations bumped to `v0.23.1`.

**Modified Files:**
- `src/shared/components/TrashIconButton.tsx` — `boxShadow` + transition addition; header bump
- `src/shared/components/PencilIconButton.tsx` — same
- `src/shared/components/ExportIconButton.tsx` — same
- `src/shared/components/CloneIconButton.tsx` — same
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1161 baseline preserved)
- Manual: hover any per-tile icon — Share/Export/Edit/Clone/Delete now all render the same colored-tint background + matching colored ring, transitions in sync

---

## Version 0.23.0 (2026-05-10)
### UX: ShareIconButton + clickable project tile + 6-dot drag handle + 18×18 icon resize

This release introduces a borderless `ShareIconButton`, makes the project tile's middle region a clickable button (replacing the "View Releases" text button), upgrades the drag handle from 3 dots to a 6-dot 2×3 grid (matching the SPERT Suite convention), restructures the per-tile icon row to keep right-side icons pixel-aligned across owner/non-owner tiles, and shrinks every per-tile icon button from 20×20 to 18×18.

**ShareIconButton (new).** Models exactly on the v17.1 / v19.0 grayscale-at-rest icon-button pattern (`PencilIconButton`, `TrashIconButton`, `ExportIconButton`, `CloneIconButton`). Borderless, transparent background at rest, gray icon (`#9ca3af`); on hover/focus the icon turns cyan (`#06b6d4`), the background tints cyan (`#ecfeff` light / `rgba(6,182,212,0.15)` dark), and a soft cyan ring (`0 0 0 1.5px rgba(6,182,212,0.5)`) appears via `box-shadow`. Transition `background 0.12s ease, box-shadow 0.12s ease`. Glyph is a user-plus (person silhouette + crosshair plus sign).

**Clickable project tile.** The middle region of every project tile (project name + release-count + finish-date metadata) is now its own `<button>` that navigates to the Releases tab on click. While the cursor is over the clickable middle region, the **entire tile** tints faint teal (`#f0fdfa` light / `rgba(20,184,166,0.10)` dark — matched to the SPERT brand teal `#14b8a6`) — drag handle, share slot, divider, and icon buttons all included — so the affordance reads at a glance even though the icons themselves are not part of the click target. Move off the middle region (onto an icon, the handle, or the surrounding padding) and the tile returns to grayscale. Focus mirrors the same state for keyboard users. The button sits as a flex-1 sibling between the drag handle and the icon group, so click events on the icons cannot bubble into the tile click — no `stopPropagation` plumbing required. `aria-label="Open releases for {project.name}"` gives screen readers a clear action name. The "View Releases" text button has been deleted; the action lives entirely in the tile gesture now. Outer-tile `draggable={true}` + drag handlers preserved verbatim.

**6-dot drag handle.** `DragHandle` is now a 2×3 grid of 6 dots instead of a 3-dot vertical column. Matches the SPERT Suite (Story Map, Forecaster, CFD, AHP) convention. Component is a CSS grid with `gridTemplateColumns: 'repeat(2, 4px)'` and `gridTemplateRows: 'repeat(3, 4px)'`; `cursor: grab` retained.

**Drag source restricted to handle.** `draggable={true}` and the `onDragStart` / `onDragEnd` handlers moved off the outer tile and onto a wrapper around the 6-dot handle. The outer tile keeps `onDragOver` so it remains a valid drop target — you can still drop anywhere on a tile to reorder, but you can only *initiate* a drag from the handle. `setDragImage(tile, 12, height/2)` is called in `onDragStart` so the drag ghost shows the whole tile rather than just the tiny handle. Cursor map across the tile is now: `grab` only on the 6 dots → `default` on the surrounding padding → `pointer` on the clickable middle → `default` between divider and icons → `pointer` on each icon button. The wrapper carries `aria-label="Drag to reorder project"` for screen readers.

**ProjectsTab icon-row restructure.** The icon area on each project tile is now two sub-groups separated by a thin vertical divider (`1px × 20px`, `colors.border`). The left slot is a fixed-footprint container (`width: calc(18px + 0.7rem)`, `height: calc(18px + 0.7rem)`, `flexShrink: 0`) that renders `<ShareIconButton>` only when `isCloudMode && user && project.owner === user.uid`. When the gate is false the slot stays the same width but is empty, so the right group (Export, Edit, Clone, Delete) keeps the same x-position on every tile regardless of ownership or storage mode.

**18×18 icon resize.** All five icon buttons (`ShareIconButton`, `ExportIconButton`, `PencilIconButton`, `CloneIconButton`, `TrashIconButton`) now ship with `width="18" height="18"` on the `<svg>` element. `viewBox="0 0 24 24"` is unchanged in every case — stroke widths scale, not crop. Header version annotations bumped to `v0.23.0` on the four pre-existing files.

**Modified Files:**
- `src/shared/components/ShareIconButton.tsx` — NEW
- `src/shared/components/DragHandle.tsx` — 3 dots → 6 dots (2×3 grid); header bump
- `src/shared/components/__tests__/DragHandle.test.tsx` — assertion 3 → 6 dots
- `src/shared/components/TrashIconButton.tsx` — 20→18 + header bump
- `src/shared/components/PencilIconButton.tsx` — 20→18 + header bump
- `src/shared/components/ExportIconButton.tsx` — 20→18 + header bump
- `src/shared/components/CloneIconButton.tsx` — 20→18 + header bump
- `src/features/projects/ProjectsTab.tsx` — import `ShareIconButton`, replace text Share button with fixed-width share slot + divider + icon group; replace "View Releases" text button with clickable middle-region `<button>` (teal hover); `tileHoverId` state added
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — navigation test retargeted to `aria-label="Open releases for Alpha"` (was: text "View Releases")
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1161 baseline preserved)
- Production build succeeds with Turbopack
- Manual: per-tile right-side icons stay pixel-aligned across local and cloud modes; ShareIconButton hover renders cyan icon + cyan tint + cyan ring together; project tile middle hovers teal and opens Releases tab on click; 6-dot handle visible to the left of the project name; ShareDialog opens unchanged on share-icon click

---

## Version 0.22.2 (2026-05-09)
### Security: app-side companion to the v0.22.2 Firestore rules audit (S1, S2, S3, S4, S5, S6, S7, S9)

This is the GanttApp client-side companion to the suite-wide `firestore.rules` deploy. No user-visible behavior changes; the entire release is defense-in-depth and identity-leak cleanup. Findings ID prefix `S` is from the v0.22.2 GanttApp security audit; rules-side changes (S1 rule layer, S2, S4) ship in `spert-landing-page` and deploy via Firebase Console / `firebase deploy --only firestore:rules`.

**S1 / S8 (HIGH) — legacy `shareProject()` deleted.** The pre-flag-on single-email Share path performed an unbounded `getDocs(collection('ganttapp_profiles'))` scan to resolve email→uid client-side. Combined with the prior `allow read: if isAuth()` rule on `ganttapp_profiles`, this permitted bulk profile enumeration by any authenticated SPERT user. Bulk invitations via the `sendInvitationEmail` Cloud Function are now the only email→share path. Companion rules tighten `ganttapp_profiles` to `get` + `limit(1)`-constrained `list`. Removals: `shareProject()` in `firestore-sharing.ts`, the corresponding method on `CloudGanttStorageService`, the `INVITATIONS_ENABLED === false` legacy panel in `ShareDialog`, the parent's `email`/`role`/`handleShare` legacy state, the `shareProject` describe blocks in `firestore-sharing.test.ts` and `firestore-gantt-storage-service.test.ts`, and the dead `FirestoreDriver` class + its test (V11).

**S2 (M5) — `ganttapp_projects` create rule binds `owner`.** Companion rules-only change. App code already wrote `owner: uid` on create; the rule layer now requires it (`request.resource.data.owner == request.auth.uid`), matching Story Map v0.29.2 / Forecaster / CFD / AHP.

**S3 Option A — `confirmKeepLocalCopy` strips cloud `owner` UID.** When a user retains their cloud projects locally on cloud→local switch, each project's `Project.owner` Firebase UID was previously persisted to `localStorage`. Subsequent browser users could read it after sign-out, cross-referencing identity across SPERT apps. Now stripped before `localService.saveAppData(...)` via destructure-and-spread. Round-trip preserved: re-upload via `projectToFirestoreMeta` re-binds `owner` from the current authenticated user.

**S4 (M4) — `ganttapp_projects` + releases + snapshots field allowlists.** Companion rules-only change. Three helper functions (`ganttAppProjectFields`, `ganttAppReleaseFields`, `ganttAppSnapshotFields`) match the converters in `firestore-converters.ts`. `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update. Closes the gap where any owner/editor could write arbitrary unknown fields.

**S5 — `Project.owner` UID stripped from JSON exports.** New `stripCloudIdentity()` helper in `export.ts` applied at all four export entry points (`exportData`, `exportAllProjects`, `exportSingleProject`, `exportSelectedProjects`). The cloud user's Firebase UID is no longer present in exported JSON files, where it could be cross-referenced if files are shared. The deliberate `_exportedBy` user attribution and `_storageRef` provenance metadata remain — only the per-project `Project.owner` field is stripped.

**S6 — `claimPendingInvitations` failure log no longer includes UID.** `console.error` in `AuthContext.tsx` previously logged `firebaseUser.uid` alongside the error code. Devtools / screenshares would otherwise expose the user's Firebase identity. Server-side Cloud Function logs include the authenticated UID via the request context, so triage doesn't lose anything.

**S7 — bare `AuthContext.signOut` deleted.** The exposed-but-unused `signOut` callback on the auth context value called `firebaseSignOut(auth)` directly, bypassing `performSignOutWithCleanup` (no cancelPendingSaves, no runAppDataReset, no storage swap, no localStorage cleanup). Verified zero live consumers via grep before deletion. All sign-out paths must now route through `StorageContext.performSignOutWithCleanup` — there is no longer an alternative.

**S9 — `subscribeToProject` permission-denied unsubscribe.** When a project owner removes a user mid-session, the user's `onSnapshot` listener fires a permission-denied error. Previously the listener kept retrying and remained in `this.unsubscribers`, occupying a slot. Now the error callback explicitly calls `unsubscribe()` and removes the entry on `permission-denied` only. Other error codes (`unavailable`, `deadline-exceeded`) remain transient and are left to the SDK's retry loop.

**Modified Files:**
- `src/shared/storage/firestore-sharing.ts` — deleted `shareProject()`; removed `setDoc` import
- `src/shared/storage/firestore-gantt-storage-service.ts` — removed `shareProject` from interface + class; hardened `subscribeToProject` error handler (S9)
- `src/shared/storage/index.ts` — removed `FirestoreDriver` and `shareProject` exports
- `src/shared/storage/firestore-driver.ts` — DELETED (dead code, V11)
- `src/shared/storage/__tests__/firestore-driver.test.ts` — DELETED
- `src/shared/storage/__tests__/firestore-sharing.test.ts` — removed `shareProject` describe block
- `src/shared/storage/__tests__/firestore-gantt-storage-service.test.ts` — removed `shareProject` describe block
- `src/features/projects/ShareDialog.tsx` — removed legacy single-email panel and the `INVITATIONS_ENABLED === false` branch; cleaned up parent state and unused imports
- `src/features/projects/__tests__/ShareDialog.test.tsx` — removed `shareProject` from mock factory
- `src/context/AuthContext.tsx` — deleted bare `signOut` from context (S7); removed UID from claim-failure log (S6)
- `src/context/__tests__/AuthContext.test.tsx` — removed `signOut` test
- `src/context/StorageContext.tsx` — strip `owner` UID in `confirmKeepLocalCopy` (S3 Option A)
- `src/shared/utils/export.ts` — added `stripCloudIdentity()` helper applied at four export entry points (S5)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1175 baseline → reduced by deleted shareProject + FirestoreDriver tests; final count established at PR merge)
- Production build succeeds with Turbopack

---

## Version 0.22.1 (2026-05-09)
### Refactor: in-file InvitationSection extraction + small dedupe sweep + sanitization hardening

This is a focused patch release: one in-file decomposition, two small DRY extractions, five small bug/safety fixes, and two type-declaration version bumps. No behavioral changes for end users.

**ShareDialog.tsx — InvitationSection extracted in-file (Story Map v0.29.1 pattern).** The bulk-invitation flow (textarea + role select + send button + invalid-tokens chip + send-result chip + pending-invitations list + revoke confirm modal) is now defined as `InvitationSection` in the same file beneath the existing member-management code. Parent (`ShareDialog`) retains: `OwnerStatus` enum, `members` state, the members-loading `useEffect`, the legacy single-email panel JSX, the remove-member `ConfirmDialog`, and the shared error path for legacy share + remove-member operations. `InvitationSection` owns its own bulk-flow state — `bulkEmail`, `role`, `bulkSending`, `sendResult`, `bulkInvalidEmails`, `pendingInvites`, `pendingLoading`, `actionBusy`, `revokeConfirmToken`, plus a localized `inviteError` so a stale bulk-send error can't leak into the member-removal UX. Members refresh after a successful send is handled via the new `onMembersUpdate` prop, and the existing `Promise.allSettled` post-send refresh + per-resource console.warn (LESSONS-LEARNED §64) is preserved verbatim. The legacy single-email panel is deliberately NOT extracted — it is marked for deletion when `INVITATIONS_ENABLED` becomes permanent, and creating a file destined for deletion would be churn for no benefit.

**`triggerJsonDownload(payload, filename)` extracted in `export.ts`.** The four export entry points (`exportData`, `exportAllProjects`, `exportSingleProject`, `exportSelectedProjects`) each contained an identical 9-line `Blob` → `URL.createObjectURL` → `<a download>` → `URL.revokeObjectURL` block. Centralized in a single private helper at the top of the file. Single point of change for download UX (e.g., a future progress toast). No behavioral change.

**`listMemberProjects()` extracted in `FirestoreGanttStorageServiceImpl`.** The "constrained `where('members.${uid}', 'in', [...])` query + client-side defense-in-depth membership filter" preamble was duplicated across `loadAppData`, `loadSnapshots`, and `saveSnapshots` (all three carrying the v0.21.0 docstring rationale). Now a single private method; the docstring lives there. No behavioral change.

**Fix — `useInvitationLanding` cloud auto-flip rejection.** Previously `void switchMode('cloud').catch(() => {})` silently swallowed any flip failure, leaving the banner stuck in `pre_auth` indefinitely with no console signal. Now logs a `[useInvitationLanding] cloud auto-flip failed:` warning, consumes `SESSION_KEY` (symmetric with `dismiss()` and Effect 4's grace-timer path), then transitions the banner back to `idle`. Recovery is automatic on transient Firestore errors.

**Fix — `shareProject` `meta.members` null guard.** `meta.members[uid]` was accessed without first verifying `meta.members` exists. A malformed project document (missing the `members` field) would throw an unhandled `TypeError` instead of the friendly "Only the project owner can share projects." error. Now guards with `if (!meta.members || meta.members[uid] !== 'owner')`. Same friendly error message; no behavioral change for healthy documents.

**Fix — Firestore-input sanitization in `firestore-converters.ts`.** `userSettingsToAppData` (settings load path) and `firestoreSnapshotToFlat` (snapshot read path) previously cast `chartColors` and `chartDisplaySettings` from Firestore directly to their typed interfaces without sanitization. Now route both through the existing `sanitizeChartColors` / `sanitizeDisplaySettings` helpers from `validation.ts` — defense-in-depth against future Firestore schema drift, manually edited documents, or third-party tools writing to the same collections. Both helpers already returned defaults on malformed input; no new utility code.

**Refactor — `migrateReleaseStatus` signature.** Accepts `{ status?: unknown; completed?: unknown }` directly instead of `Record<string, unknown>`. Eliminates the two `data as unknown as Record<string, unknown>` double casts at the call sites in `firestore-converters.ts` (`firestoreReleasesToFlat` and `firestoreSnapshotToFlat`). Pure type-signature change; runtime behavior unchanged.

**Deps — type-only bumps.** `@types/react` `^19` → `^19.2.14` (released 2026-02-11); `@types/react-dom` `^19` → `^19.2.3` (released 2025-11-12). Both pre-60-day window. All other dependency updates (firebase, next, react, vitest, eslint-config-next, etc.) released within the 60-day window per repo policy and are intentionally held for v0.22.2+.

**Modified Files:**
- `src/features/projects/ShareDialog.tsx` — defined `InvitationSection` in-file; moved bulk-flow state, listPendingInvites useEffect, bulk handlers, and revoke ConfirmDialog into it; replaced flag-on render branch
- `src/shared/utils/export.ts` — added `triggerJsonDownload` helper; deduped 4 download blocks
- `src/shared/utils/validation.ts` — `migrateReleaseStatus` signature change
- `src/shared/utils/firestore-converters.ts` — applied sanitizers at 3 cast sites; dropped 2 double casts
- `src/shared/storage/firestore-gantt-storage-service.ts` — added `listMemberProjects()` private helper; deduped 3 preambles; added `QueryDocumentSnapshot` to firestore-type imports
- `src/shared/storage/firestore-sharing.ts` — added `meta.members` null guard in `shareProject`
- `src/shared/hooks/useInvitationLanding.ts` — replaced silent catch with logged-rejection + idle reset path (consumes `SESSION_KEY` first)
- `src/shared/storage/__tests__/firestore-sharing.test.ts` — +1 test for `members === undefined` guard
- `src/shared/hooks/__tests__/useInvitationLanding.test.ts` — new test file, +1 test for cloud auto-flip rejection branch
- Version + docs: `src/lib/version.ts`, `package.json` (with type-decl bumps), `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All 1173 existing tests pass; +2 targeted tests added (1175 total)
- Production build succeeds with Turbopack

---

## Version 0.22.0 (2026-05-08)
- **Fix** — **Bulk-sharing retrograde-audit remediation** (May 2026 audit). Nine confirmed gaps fixed across two PRs, hardening the invitation-banner state machine, the bulk-send pipeline, and the member-removal transaction
- **Fix** — `removeCollaborator` now runs all four guards inside `runTransaction` so the project-exists check, both ownership guards, and the membership write + `_changeLog` append cannot interleave with concurrent owner activity. New pre-transaction guard 1 surfaces a user-friendly “Cannot remove yourself from a project.” when an owner clicks Remove on themselves (LESSONS-LEARNED §50)
- **Fix** — `claimPendingInvitationsAndNotify` short-circuits on `firebaseUser.emailVerified === false`. Microsoft personal accounts and unverified Google accounts no longer trigger noisy `failed-precondition` console errors on every auth resolution (LESSONS-LEARNED §26)
- **Fix** — `useInvitationLanding` rewrite. Cloud auto-flip on invite-link arrival is now gated on `localProjectCount === 0` so users with local content keep their projects (LESSONS-LEARNED §28). The `spert:models-changed` listener checks `sessionStorage[SESSION_KEY]` as its first line so spurious “you've been added to” banners no longer appear on normal sign-in (LESSONS-LEARNED §27). A 30 s grace timer transitions stuck `pre_auth` back to `idle` and consumes `SESSION_KEY` before `setState` so a reload mid-timer cannot rehydrate the stale state (LESSONS-LEARNED §59)
- **Fix** — `parseBulkEmails` now returns `{ valid, invalid }` and runs every token through `EMAIL_RE`. Share dialog renders rejected tokens in a red “Skipped N: …” chip below the textarea instead of silently dropping them. When zero addresses are valid, no CF call fires and the textarea content is preserved so typos can be corrected in place (LESSONS-LEARNED §42)
- **Fix** — Share dialog gains a four-state `OwnerStatus` enum (`loading` / `owner` / `not-owner` / `error`). When `getProjectMembers` rejects, the bulk UI is replaced by “Couldn't load sharing details. Refresh the page to try again.” rather than leaving the user with a half-loaded dialog (LESSONS-LEARNED §60)
- **Fix** — Post-send refresh now uses `Promise.allSettled`. A transient error on `listPendingInvites` can no longer discard a fulfilled `getProjectMembers` value, and the members list updates independently (LESSONS-LEARNED §64)
- **Refactor** — `useInvitationLanding` initial state now derived in a `useState` lazy initializer. Pages Router has no SSR justification for `setState`-in-effect, so the `react-hooks/set-state-in-effect` rule holds without an `eslint-disable`. Eliminates the visible “idle → pre_auth” flicker on invite-link arrivals (LESSONS-LEARNED §66)
- **UX** — `InvitationBanner` renders as a 512 px max-width centered card so the sign-in CTA sits at the visual focus of the page. `FirstRunBanner` stays full-width as a passive info strip — the deliberate divergence is documented inline (LESSONS-LEARNED §56)
- **Tests** — +6 EMAIL_RE coverage tests on `parseBulkEmails`, +3 transaction-guard tests on `removeCollaborator`, +1 service-wrapper test for owner self-removal. Suite total: 1167 → 1173 (no regressions)

---

## Version 0.21.1 (2026-05-05)
### UX: De-emphasize Export All / Import toolbar buttons

The Export All and Import buttons in the Projects toolbar were filled, high-contrast buttons with emoji + bold label. They are infrequently used (most users export at end of session, import only when restoring or transferring a workspace) and were the last toolbar elements still using the pre-v17.1 button style.

This release rebuilds them as grayscale icon+text buttons that adopt color only on hover/focus, matching the v17.1 trashcan and v19.0.0 per-tile icon button pattern:

- **At rest:** icon stroke + text in `#9ca3af`, transparent background, transparent 1px border (reserves space, no layout shift on hover), `0.4rem 0.75rem` padding, `0.4rem` icon-text gap, font-weight `500`
- **Export All hover/focus:** icon + text `#10b981`, 1px green border, soft green background fill (`#ecfdf5` light / `rgba(16, 185, 129, 0.15)` dark)
- **Import hover/focus:** icon + text `#0070f3` (GanttApp primary blue, same as `PencilIconButton`), 1px blue border, soft blue background fill (`#eff6ff` light / `rgba(0, 112, 243, 0.15)` dark)
- `transition: all 0.12s ease` on both, matching existing icon buttons

**Icons.** Export All reuses the exact SVG path from `ExportIconButton` (down-arrow-into-tray) at 18×18 instead of 20×20, since the icon is now paired with a text label. Import uses an inline up-arrow-into-tray glyph (`d="M21 15v4...M17 8l-5-5-5 5M12 3v12"`) — same tray, chevron points up, vertical bar terminates at the top — so the two read as a matched pair.

**Implementation.** Inline in `ProjectsTab.tsx`, not a new shared component. Two reasons: only two call sites ever; the Import button must remain a `<label>` wrapping a hidden file `<input>` so the native file picker opens without a click handler — awkward to model in a generic icon-button component. Hover state is two local `useState<boolean>` hooks (`exportAllHover`, `importHover`) with `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur`, matching the inline hover pattern already used elsewhere in this file. Added `resolvedTheme` to the existing `useTheme()` destructure for the dark-mode hover-bg variant.

**A11y.** Both buttons gain `aria-label`s ("Export all projects as JSON", "Import projects from JSON") so screen reader users still get a clear action name as the visible styling becomes more subtle. Visible text labels ("Export All", "Import") preserved — existing test queries by visible text continue to work.

**No behavior changes.** Click handlers, file-picker behavior, the v19.0.0 toolbar position (between form card and tile list), and zero-projects centering (`justifyContent: data.projects.length === 0 ? 'center' : 'flex-end'`) all preserved.

**Modified Files:**
- `src/features/projects/ProjectsTab.tsx` — added `resolvedTheme` to `useTheme()` destructure, two `useState` hover hooks, replaced the two filled `<button>` / `<label>` JSX blocks with grayscale-on-rest / colored-on-hover icon+text variants
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All tests pass (cosmetic restyling — visible text labels unchanged, no new tests required)
- Production build succeeds with Turbopack

---

## Version 0.21.0 (2026-05-05)
### Fix: Cloud projects load again in multi-tenant Firestore

User reported all cloud project loads failing with `Permission denied` errors after multiple uids accumulated in the `ganttapp_projects` collection (Microsoft + Google profile sessions during v0.20.1 testing). Root cause: the Firestore `list` rule referenced `resource.data.members[request.auth.uid]`, which Firestore cannot evaluate for `list` operations (rules apply to query shape, not per-document). The unconstrained `getDocs(collection(...))` call worked when the user owned every project in the collection, broke as soon as any foreign-owned doc was present.

**App fix:** Three unconstrained collection queries in `firestore-gantt-storage-service.ts` (`loadAppData` line 116, `loadSnapshots` line 191, `saveSnapshots` line 223) now use a constrained `where('members.${uid}', 'in', ['owner', 'editor', 'viewer'])` clause. Server-side filter returns only the user's projects. Client-side membership check kept as defense-in-depth.

**Rules fix:** `ganttapp_projects/list` rule relaxed to `if isAuth()` only. Rules cannot validate dynamic field paths in `where()` clauses, so the suite-wide canonical pattern is to authenticate the list, then trust the constrained `where()` clause to filter results server-side. Matches the pattern adopted by SPERT-Story-Map in v0.14.3 and documented in `cloud-storage-guide/ARCHITECTURE.md` §6.5 + §7.

**Security tradeoff:** authenticated SPERT users could in principle issue an unconstrained `list` to see project metadata (name, owner, members map, finishDate, workDays, legendLabels). No release content or snapshot content is exposed (subcollection rules unchanged — still use `isMemberGet(projectId)`). This is the same security posture every other SPERT app's projects collection already operates under.

**Modified Files:**
- `src/shared/storage/firestore-gantt-storage-service.ts` — added `where` import; constrained queries in `loadAppData`, `loadSnapshots`, `saveSnapshots`
- `src/shared/storage/__tests__/firestore-gantt-storage-service.test.ts` — +1 regression test
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`
- (Separate) `spert-landing-page/firestore.rules` — mirror PR after Console deploy

**Verification:**
- All 1166 tests pass (+1 net new)
- TypeScript type-check clean
- Production build succeeds with Turbopack
- Lint clean
- Manual post-deploy: Microsoft sign-in loads projects without console errors; Share button (v0.20.1 fix) appears on owned tiles

---

## Version 0.20.1 (2026-05-05)
### Fix: Share button on owned project tiles in cloud mode

Three related fixes for in-memory `Project.owner` handling, after a user reported the Share button missing on tiles for projects they verifiably owned in Firestore.

**Bug A — `addProject` doesn't seed `owner` (primary cause).** When a project is created in cloud mode, the in-memory `Project` had no `owner` field. Firestore wrote the owner correctly via `projectToFirestoreMeta`, but in-memory state stayed owner-less until the next full reload re-fetched the project. Between creation and reload, the Share button render condition `project.owner === user.uid` evaluated false. Fix: seed `owner` inline in the `newProject` literal when in cloud mode and signed in.

**Gap C — `cloneProject` propagates source's `owner` blindly.** `useProjects.cloneProject` used `...source` spread, so cloning a project shared *to* you carried the original owner's uid into the clone's in-memory state. Firestore overwrote it on save (via `existingMeta?.owner ?? uid`), but in-memory was wrong until reload. Fix: replace bare spread with explicit field copy that excludes `owner`, then conditionally re-add it bound to the current user.

**Bug B — `validateLoadedData` strips `owner` on localStorage round-trip (defense-in-depth).** The localStorage sanitizer dropped the `owner` field. Any path where cloud-mode data round-tripped through the local validator would lose ownership. Fix: preserve `owner` through `sanitizeId()` when present.

**Modified Files:**
- `src/features/projects/useProjects.ts` — added `useAuth()`, seed `owner` in `addProject` and `cloneProject`
- `src/shared/utils/storage.ts` — preserve `owner` field in `validateLoadedData`
- `src/lib/version.ts` — `APP_VERSION` → `0.20.1`
- `package.json` — version field
- `src/features/changelog/changelog-data.tsx` — new entry prepended
- `CHANGELOG.md`, `public/CHANGELOG.md` — new entry prepended
- `CLAUDE.md` — Current Version + this subsection
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — version-order assertion updated
- `src/features/projects/__tests__/useProjects.test.tsx` — +2 regression tests
- `src/shared/utils/__tests__/storage.test.ts` — +4 regression tests

**Verification:**
- All 1171 tests pass (up from 1165, +6 net new)
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 0.20.0 (2026-05-04)
### Versioning realignment with SPERT® Suite

GanttApp's versioning is being reset from `19.0.0` to `0.20.0` to align with the rest of the SPERT® Suite, which uses standard `0.x.x` semver because none of those apps have reached a true 1.0 yet (planned for 2027). GanttApp was the first app in the suite and predated the convention. This is a one-time deliberate jump with zero functional impact — no code or behavior changes ship in this release. The "20" preserves the "20th release" intuition (v19 was last).

All historical changelog entries below remain labeled under their original version numbers (v3.0 through v19.0.0) — we don't rewrite history.

**Going forward**, GanttApp follows standard pre-1.0 semver:
- **Patch** bumps (`0.20.1`) — bug fixes, security patches, copy/style tweaks, doc-only changes.
- **Minor** bumps (`0.21.0`) — new features, behavior changes, refactors that touch user-visible state.
- No MAJOR bump until the eventual 1.0 launch (planned 2027).

This is a behavior change from the prior habit of treating MAJOR as feature-level (e.g. v18.0.0, v19.0.0 were feature releases under the old convention).

**Modified Files:**
- `src/lib/version.ts` — `APP_VERSION` constant
- `package.json` — version field (and `package-lock.json` regenerated by `npm install`)
- `src/features/changelog/changelog-data.tsx` — new entry prepended
- `CHANGELOG.md`, `public/CHANGELOG.md` — new entry prepended
- `CLAUDE.md` — Current Version + new history subsection
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — assertion updated

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 19.0.0 (2026-05-04)
### Per-project export, clone, and merge import

User-facing release. Project tiles get three new icon buttons next to Delete: download (export single project), pencil (edit), and duplicate (clone). The clone copies the project, all releases, and all snapshots; if cloning snapshots would exceed the 100-snapshot workspace cap, the project + releases still clone and the user is told via `alert()` that snapshots were skipped.

Importing a single-project file (anything tagged `_exportType: 'ganttapp-project-export'`) now performs an additive merge instead of a full replace. Projects whose `id` collides with an existing one are skipped with a count reported to the user. Importing an Export-All file (`_exportType: 'ganttapp-all-projects'`) or a legacy file with no `_exportType` still triggers the existing replace-all confirmation dialog — behavior is unchanged for those.

A new **Export Projects** section in Settings lets the user pick one, several, or all projects via checkboxes, with an optional all-or-nothing "Include snapshots" toggle.

The Export All / Import buttons moved out of the page header row into a toolbar row between the project form and the project tile list. Import remains visible at zero projects (must be reachable for first-import); Export All is hidden at zero projects.

The local-storage warning banner's text and "Got it" button are now vertically centered.

**New shared icon-button components (3):**
- `src/shared/components/PencilIconButton.tsx` — blue (`#0070f3`) hover.
- `src/shared/components/ExportIconButton.tsx` — green (`#10b981`) hover.
- `src/shared/components/CloneIconButton.tsx` — violet (`#8b5cf6`) hover.

All three follow the v17.1 `TrashIconButton` pattern: grayscale `#9ca3af` at rest, theme-aware tinted hover background, hover via `useState` + `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`, `disabled` prop suppresses hover.

**New export utility functions (`src/shared/utils/export.ts`):**
- `exportSingleProject(projectId, data, storage, options)` — downloads project + releases (+ optional snapshots) tagged `_exportType: 'ganttapp-project-export'`. Filename `ganttapp-{slug}-{YYYY-MM-DD}.json`.
- `exportSelectedProjects(projectIds, data, storage, options)` — same shape, batch variant. Filename `ganttapp-projects-export-{YYYY-MM-DD}.json`.
- `mergeImportedProjects(existing, incoming, existingSnapshots)` — partitions incoming projects by ID-collision, returns `{ mergedData, mergedSnapshots, skipped }`. Releases and snapshots filtered to accepted project IDs; snapshot dedup by ID.

**`ImportResult` type extended** with discriminator field `exportType: 'ganttapp-all-projects' | 'ganttapp-project-export' | 'legacy'` (set by `parseImportedData()` from `imported._exportType`). The `applyImport` (replace-all) call site uses it to route between the existing replace-all confirm dialog and the new merge confirm dialog.

**`cloneProject` added to `useProjects`:**
- Builds a unique name with `- Copy (N)` suffix (collision-checked against existing names).
- Inserts the clone immediately after the source in the project list.
- Selection stays on the original project — user does not lose their place.
- Snapshot block uses `storage.saveSnapshots([...existing, ...cloned])` (single batch write, not `Promise.all` of `addSnapshot` — would race on the cloud implementation).
- Pre-checks the 100-snapshot cap; if cloning snapshots would exceed it, project + releases still clone and the user gets an `alert()` saying snapshots were skipped.

**Settings → Export Projects section (new):**
- New file `src/features/settings/ExportProjectsSection.tsx`. Inline-styled (matches Settings convention).
- Per-project checkbox + release count. "Select all" / "Deselect all" toggle in the header row. "Include snapshots" toggle below the list.
- Disabled when no projects selected; disabled during in-flight export.
- Wired into `SettingsTab` after `ExportAttributionSection` and before `WorkWeekSection`.

**Refactor — snapshot-limits constants extracted:**
- `MAX_SNAPSHOTS_TOTAL = 100` and `MAX_SNAPSHOTS_PER_PROJECT = 50` were duplicated as private `const`s in both `local-gantt-storage-service.ts` and `firestore-gantt-storage-service.ts`. Extracted to `src/shared/storage/snapshot-limits.ts` and imported by all three call sites (the two storage services and `useProjects.cloneProject`). Single source of truth.

**Refactor — `ConfirmDialog` modal-mode `'primary'` variant:**
- Modal-mode rendering only handled `'danger'` vs default outline. Added a `'primary'` branch (`#0070f3` background, white text, no border) used by the new merge-import "Add Projects" CTA.
- Inline-mode rendering already handled `'primary'` (transparent bg, blue outline) since v12.1. Unchanged.

**Per-tile action group (final left-to-right order):**
```
[View Releases]  [Share — cloud only]  [⬇ Export]  [✏ Edit]  [⧉ Clone]  [🗑 Delete]
```

**Edit-pencil UX:**
- Click scrolls to top via `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- 600 ms blue-glow highlight pulse on the form card via local `editHighlight` state + setTimeout.
- Keyboard (`tabIndex` is the wrapping `<button>`) and screen reader (`aria-label="Edit project"`) parity with the prior text button.

**Modified Files:**
- `pages/index.tsx` — version footer.
- `package.json`, `src/lib/version.ts` — version bump.
- `src/shared/components/LocalStorageWarningBanner.tsx` — `alignItems: 'flex-start'` → `'center'`.
- `src/shared/components/ConfirmDialog.tsx` — modal-mode `'primary'` branch.
- `src/shared/utils/export.ts` — extended `ImportResult`, three new export functions, slug helper.
- `src/shared/utils/index.ts` — re-export the three new functions.
- `src/shared/storage/local-gantt-storage-service.ts`, `src/shared/storage/firestore-gantt-storage-service.ts` — import snapshot caps from `snapshot-limits.ts`.
- `src/features/projects/useProjects.ts` — `cloneProject`.
- `src/features/projects/ProjectsTab.tsx` — toolbar repositioning, three new icon buttons per tile, `editHighlight`, `applyMergeImport`, merge confirm dialog.
- `src/features/settings/SettingsTab.tsx` — wire `<ExportProjectsSection>`.
- Version + docs: `src/features/changelog/changelog-data.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`, `ARCHITECTURE.md`.

**New Files (10):**
- `src/shared/components/PencilIconButton.tsx`, `ExportIconButton.tsx`, `CloneIconButton.tsx`.
- `src/shared/storage/snapshot-limits.ts`.
- `src/features/settings/ExportProjectsSection.tsx`.
- Tests: `__tests__/PencilIconButton.test.tsx`, `__tests__/ExportIconButton.test.tsx`, `__tests__/CloneIconButton.test.tsx`, `src/features/settings/__tests__/ExportProjectsSection.test.tsx`, `src/shared/storage/__tests__/snapshot-limits.test.ts`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 18.0.0 (2026-05-04)
### Bulk Invitations

Major feature release: bulk-invitation flow on the Share Project dialog. Project owners paste multiple email addresses, pick a role, and send invitations in one round-trip via the SPERT&reg; Suite Cloud Functions. Existing suite members are auto-added immediately; new users receive a branded invitation email and are auto-claimed on next sign-in.

**New on the Share Project dialog (cloud mode only):**
- Bulk email textarea — splits on commas, semicolons, and whitespace; lowercases and dedupes.
- Role selector — Editor or Viewer (the same two roles supported by single-email sharing).
- Result chip after sending — `Added N: ...`, `Invited N: ...`, `Skipped N: <email> (reason)`.
- Pending invitations list — shows recipient email, role, and `sent N/5` send-count. Per-row Resend (text button) and Revoke (trashcan icon with `ConfirmDialog`).
- Server-side caps enforced by Cloud Functions: 25 invitations / user / day; 5 resends per pending invitation.

**New `InvitationBanner` (mounted above `FirstRunBanner`):**
- Three states: `idle` (hidden), `pre_auth` (URL contains `?invite=<token>` or sessionStorage token survives reload), `claimed` (`spert:models-changed` event fired with one or more claimed models).
- Pre-auth state shows Google and Microsoft sign-in buttons. Sign-in routes through the existing `useSignInWithTosGate` hook (v17.0); Terms-of-Service consent flow cannot be bypassed.
- Claimed state shows "You've been added to: &lt;project list&gt;" and the projects appear in the project list automatically.

**Backend prerequisite (already deployed):**
- `spert-landing` Cloud Functions register `ganttapp` as a supported `appId`. Allowed origins: `https://ganttapp.spertsuite.com` (prod) and `http://localhost:3000` through `http://localhost:3010` (dev). From-line branded as "via GanttApp".

**Architecture changes:**
- `writeUserProfile` in `AuthContext` dual-writes `ganttapp_profiles/{uid}` + `spertsuite_profiles/{uid}` on every auth resolution. The cross-app `spertsuite_profiles` write enables `sendInvitationEmail`'s email→uid lookup. Microsoft AD "Last, First Middle" displayName format is denormalized to "First Middle Last" via the new `denormalizeLastFirst` helper (mirrors the server-side normalization in `mailHeaders.ts`).
- `setUserAndClaim` is the single exit point for every authenticated `onAuthStateChanged` callback path. It calls `writeUserProfile` (fire-and-forget), `setUser`, then `claimPendingInvitationsAndNotify`. The latter calls the `claimPendingInvitations` Cloud Function and dispatches a `spert:models-changed` window event with the array of newly-claimed models.
- `createUserProfile` deleted from `firestore-sharing.ts` and `FirestoreGanttStorageServiceImpl`. Two prior call sites (`StorageContext.tsx` mount-restore branch and `storage-mode-switch.ts` cloud upload) removed. Profile writes are no longer gated on cloud-mode switching.
- `removeProjectMember` renamed → `removeCollaborator`. Refactored to use `deleteField()` on the specific `members.{uid}` key with `merge: true`, rather than overwriting the full document. Race-safe under concurrent membership changes. Rename applies in both flag states; the flag-off Share input panel JSX is preserved byte-identical.
- `listPendingInvites(projectId)` query reuses the existing composite index `(inviterUid ASC, modelId ASC, createdAt DESC)` on `spertsuite_invitations`. Status filter (`status === 'pending'`) is applied in code, not in the query, to stay within the deployed index.

**Save-back guard for cross-app claim events:**
- `AppDataContext` listens for `spert:models-changed` events. When dispatched in cloud mode, the listener bumps a `reloadCounter` state, which is in the load effect's dependency array — triggering `loadAppData()` to refresh the project list with the newly-claimed project.
- A new `loadedDataRef` mechanism in the save effect short-circuits when `data === loadedDataRef.current`, ensuring the post-load save effect run does NOT write the just-loaded cloud data back to Firestore. Without this, every claim event would trigger a full Firestore write and risk clobbering concurrent collaborator edits on the just-claimed project. Covered by a CI-gated regression test (`src/context/__tests__/AppDataContext.spertModelsChanged.test.tsx`).

**Cloud Functions integration (`src/lib/firebase.ts`):**
- New `firebase/functions` import. Module-scoped `functionsInstance` initialized when `isFirebaseAvailable === true`. Region `us-central1`.
- Four typed callable getters: `getSendInvitationEmail`, `getClaimPendingInvitations`, `getRevokeInvite`, `getResendInvite`. Each returns `null` when Firebase is unavailable. The callable `appId` is hardcoded as the string literal `'ganttapp'`, distinct from `APP_ID` in `version.ts` (LESSONS-LEARNED §15).

**New utilities:**
- `src/lib/auth-name.ts` — `denormalizeLastFirst()` (mirrors `mailHeaders.ts`).
- `src/lib/invitation-errors.ts` — `mapInvitationError(err, context)` with `'send' | 'resend' | 'revoke'` discriminator. Required because Firebase HttpsError codes are a small enum (`resource-exhausted` means different things in send vs resend; LESSONS-LEARNED §13).
- `src/shared/utils/parseBulkEmails.ts` — splits on commas/semicolons/whitespace, lowercases, dedupes. Uses `Array.from(new Set(...))` rather than spread (`tsconfig` target is `es5`).
- `src/lib/feature-flags.ts` — `INVITATIONS_ENABLED` constant.

**New shared components:**
- `src/shared/components/AuthProviderLogos.tsx` — `GoogleLogo` and `MicrosoftLogo` SVGs extracted verbatim from `CloudStorageModal.tsx` so `InvitationBanner` can reuse them.
- `src/shared/components/InvitationBanner.tsx` — three-state banner driven by `useInvitationLanding`.
- `src/shared/hooks/useInvitationLanding.ts` — Pages Router-compatible hook (uses `window.location` / `history.replaceState`; no `<Suspense>` boundary needed because GanttApp does not use the App Router).

**Modified Files (16):**
- `pages/index.tsx` — mount `InvitationBanner` above `FirstRunBanner`.
- `src/context/AppDataContext.tsx` — `reloadCounter`, `loadedDataRef`, `spert:models-changed` listener.
- `src/context/AuthContext.tsx` — `firebaseAvailable` field, `writeUserProfile`, `claimPendingInvitationsAndNotify`, `setUserAndClaim` single-exit-point.
- `src/context/StorageContext.tsx` — removed `createUserProfile` mount-restore call.
- `src/context/storage-mode-switch.ts` — removed `createUserProfile` cloud-upload call.
- `src/features/projects/ShareDialog.tsx` — bulk send, pending list, Resend/Revoke handlers, two-boolean busy-state split (`bulkSending` vs per-invite `actionBusy`).
- `src/lib/firebase.ts` — `firebase/functions` integration + 4 callable getters.
- `src/shared/components/CloudStorageModal.tsx` — extracted logos imported from new `AuthProviderLogos.tsx`.
- `src/shared/storage/firestore-gantt-storage-service.ts` — interface + 4 cloud methods.
- `src/shared/storage/firestore-sharing.ts` — `removeCollaborator` (renamed + refactored), `listPendingInvites` (new), `createUserProfile` (deleted).
- `src/shared/storage/index.ts` — barrel export updated.
- `src/shared/types/firestore.ts` — `PendingInvite` type, `InvitationStatus` union.
- Tests: 4 new files + 4 updated files; 1076 → 1108 tests across 65+ files.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.
- CORS smoke-test from `https://ganttapp.spertsuite.com` and `http://localhost:3000` against all three new callables — all returned `HTTP/2 204` with correctly-echoed `access-control-allow-origin`.
- Composite index `(inviterUid ASC, modelId ASC, createdAt DESC)` on `spertsuite_invitations` already deployed.

**Manual verification (post-deploy, ongoing):**
- Resend dashboard delivery rate over the first 48 hours.
- `spertsuite_rate_limits` for unexpected 25/day cap hits.
- ToS consent flow with a brand-new Google account.

---

## Version 17.3.3 (2026-05-03)
### Form-Field Hygiene Residual Sweep

Closes the form-hygiene gaps not covered by v17.3.2. Goal: zero form-field-related entries in Chrome DevTools Issues panel.

**Rule 2 — `id` or `name` on every form control.** Every `<input>`, `<textarea>`, and `<select>` in the codebase now carries a `name` attribute. Stable, semantic camelCase names (e.g. `projectName`, `releaseTargetDate`, `showTodayLine`). 31 inputs and 3 selects touched.

**Rule 3 — Label association.** Every sibling-style `<label>` is now associated with its input via `htmlFor` + matching `id`. `id` values come from `useId()` (per-component instance, suffix-per-field) — collision-free across re-renders and concurrent instances. Pattern adopted in 5 files: `ProjectsTab.tsx` (project name + finish date), `ReleaseFormFields.tsx` (5 release-form fields), `DefaultLegendLabelsSection.tsx` (5 rows in `.map()` with per-row stable key), `ExportAttributionSection.tsx` (Name + Identifier), `ColorSwatchPicker.tsx` (Custom Color).

**Rule 4 — Orphan `<label>` cleanup.** `ProjectsTab.tsx` had a `<label>` for the Work Week section pointing at `WorkWeekSelector` (a custom button-group with no single form input). Converted to a styled `<span>` and added an inline comment explaining why.

**Rule 1 — `autoComplete` (one residual).** Added `autoComplete="name"` to the Export Attribution Name input (placeholder "e.g., Jane Smith" matches the personal-name pattern; user's own name; preemptive hygiene). The Identifier sibling stays free of `autoComplete` because its placeholder "e.g., student ID, email, or team name" is intentionally generic.

**Adjacent accessibility fixes (in passing).** Inputs that lack a surrounding `<label>` got `aria-label` so screen readers don't announce them as nameless edit fields:
- ChartSettings "Prepared By" text input.
- ShareDialog email input + role select.
- ReleasesTab project picker select + GanttChart project picker select.
- InlineDateEditor, InlineTextEditor, ChartLegend inline-edit input.

**Skipped (intentional, per the playbook's app-domain rule):**
- Project name, release name, default legend label rows, ChartLegend inline-edit, InlineTextEditor — text inputs collecting app-domain content (titles, labels), not categories the browser knows how to autofill.
- Export Attribution Identifier — intentionally generic format hint.
- All `type="date" | "checkbox" | "radio" | "color" | "file"` inputs — excluded from `autoComplete` by rule.

**No shared form wrapper exists.** Verified zero `Field`/`FormField`/`LabeledInput` components in `src/`. All forms compose `<label>` and `<input>` inline. Touching individual call sites was the right move; no refactor opportunity to propagate.

**Reuse callouts:**
- StorageSection's two radios share `name="storageMode"` (correct radio-group pattern). CloudStorageModal's two radios share `name="cloud-modal-storage-mode"` (same).
- ProjectsTab and ReleasesTab + GanttChart project pickers got distinct names (`releasesTabSelectedProject`, `chartTabSelectedProject`) — they live on different tabs and never coexist in a real `<form>`, so reuse would have been safe, but distinct names make a future `<form>`-wrapping refactor easier.

**Modified Files (15):**
- `src/features/projects/ProjectsTab.tsx` — `useId`, two label/input pairs, file-input `name`, orphan label → `<span>`.
- `src/features/releases/ReleaseFormFields.tsx` — `useId`, five label/input pairs.
- `src/features/releases/ReleasesTab.tsx` — project select `name` + `aria-label`, visibility-checkbox `name`.
- `src/features/settings/DefaultLegendLabelsSection.tsx` — `useId` + per-row `key` field on rows array, label/input pairs in `.map()`.
- `src/features/settings/ExportAttributionSection.tsx` — `useId`, two label/input pairs, `autoComplete="name"` on Name.
- `src/features/settings/TosConsentModal.tsx` — checkbox `name`.
- `src/features/chart/ChartSettings.tsx` — `name` on 5 checkboxes + `name`/`aria-label` on Prepared By text input.
- `src/features/chart/ChartLegend.tsx` — inline-edit input `name` + `aria-label`.
- `src/features/chart/GanttChart.tsx` — project select `name` + `aria-label`.
- `src/features/projects/ShareDialog.tsx` — email input `name` + `aria-label`, role select `name` + `aria-label`.
- `src/shared/components/ColorPickers/ColorSwatchPicker.tsx` — `useId`, label/color-input pair.
- `src/shared/components/InlineDateEditor.tsx` — `name` + `aria-label`.
- `src/shared/components/InlineTextEditor.tsx` — `name` + `aria-label`.
- `src/shared/components/LocalStorageWarningToggle.tsx` — checkbox `name`.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `public/CHANGELOG.md`.

**DevTools Issues panel verification checklist (post-deploy, manual):**
1. Visit `/` (Projects tab default). Open DevTools → Issues panel.
2. Click "Gantt Chart" tab — expand Chart Settings (click the heading).
3. Click "Releases" tab — pick a project; toggle the Show checkbox; click Edit on a release.
4. Click "Settings" tab — interact with Storage, Export Attribution, Default Legend Labels, Notifications.
5. Open ShareDialog (cloud mode only).
6. Open Cloud Storage modal from the header chip.
7. Confirm zero entries under "Form field element should have an id or name attribute", "No label associated with a form field", "Incorrect use of `<label for=FORM_ELEMENT>`", "Duplicate id on a page", and "autocomplete attribute valid value".

**Verification:**
- All 1043 tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.3.2 (2026-05-03)
### Surface Cloud Errors + autoComplete Hygiene

Three-category bug-fix wave from a multi-app Statistical PERT® sweep.

**Cloud auto-save errors no longer silent.** `FirestoreGanttStorageServiceImpl.executeSave` previously logged failures with `console.error` and re-queued the data, but the user never saw that their last edit had failed to reach Firestore. The service now accepts an optional `onSaveResult(error: string | null)` callback. `StorageContext` wires it to a new `saveError` state, which renders in **Settings → Storage** using the same red-text pattern as `switchError` and `authError`. The error clears automatically after the next successful save (the same callback fires with `null` on success).

**`onSnapshot` listeners now have error callbacks.** Both call sites — `FirestoreGanttStorageServiceImpl.subscribeToProject` and `FirestoreDriver.onRemoteChange` — previously passed only a success callback. Permission revocations and network drops failed silently. Both now pass an error handler that logs via `sanitizeFirebaseError`; the project-level subscription additionally surfaces the message through the same `onSaveResult` channel as auto-save. GanttApp does not maintain a doc-keyed listener tracking map, so no entry needs to be removed for re-subscription; a full reconnect mechanism is deferred.

**Two `autoComplete` attributes added.**
- `ShareDialog.tsx` email input → `autoComplete="off"` (collects another user's email, not the signed-in user's — autofilling would be wrong; active browser-warning fix).
- `ChartSettings.tsx` "Prepared By" text input → `autoComplete="name"` (placeholder "Enter your name" matches the personal-name pattern; preemptive hygiene).

**Note on `FirestoreDriver`.** `FirestoreDriver` has no production caller — it is referenced only by its barrel export and test file. The error-handler addition is symmetric maintenance to keep the storage interface implementation consistent for any future use; the runtime risk reduction comes from the `subscribeToProject` site, which is the listener actually used by `AppDataContext`.

**Modified Files:**
- `src/shared/storage/firestore-gantt-storage-service.ts` — `onSaveResult` constructor parameter, `executeSave` calls callback on both success (`null`) and failure (sanitized message), `subscribeToProject` now passes an error callback.
- `src/shared/storage/firestore-driver.ts` — `onRemoteChange` now passes an error callback that logs via `sanitizeFirebaseError`.
- `src/context/storage-mode-switch.ts` — `switchToCloudMode` accepts and forwards `onSaveResult`.
- `src/context/StorageContext.tsx` — new `saveError`/`clearSaveError` exposed in context; stable `handleSaveResult` callback passed to both constructor sites; cleared in `performSignOutWithCleanup`.
- `src/features/settings/StorageSection.tsx` — new `saveError` prop; renders a red `<p>` "Cloud sync error: …" beneath the existing error rows.
- `src/features/settings/SettingsTab.tsx` — pulls `saveError` from `useStorage()` and forwards it.
- `src/features/projects/ShareDialog.tsx` — `autoComplete="off"` on email input.
- `src/features/chart/ChartSettings.tsx` — `autoComplete="name"` on Prepared By input.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.3 (2026-05-01)
### Branded Favicon and Header Icon

New `spert-favicon-ganttapp.png` (192×192 PNG, teal `#0891b2` panels with rounded corners) replaces the legacy `favicon.ico` as the browser tab icon and now appears immediately to the left of the "GanttApp™" title in the header. A charcoal dark-mode variant (`spert-favicon-ganttapp-dark.png`) auto-swaps when the active theme is dark, driven by the existing `useTheme()` hook (`resolvedTheme === 'dark'`).

**Modified Files:**
- `public/spert-favicon-ganttapp.png` — new branded favicon (moved from repo root).
- `public/spert-favicon-ganttapp-dark.png` — new charcoal dark-mode variant (generated by replacing near-black pixels with `#2a2a2a` so the center mark stays legible against dark backgrounds).
- `pages/index.tsx` — replaced `<link rel="icon" href="/favicon.ico" />` with `<link rel="icon" type="image/png" href="/spert-favicon-ganttapp.png" />`; wrapped `<h1>` in a flex row containing the new `<img>` icon, sized 28×28 with `borderRadius: '11%'` to match the baked-in corner radius.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.2 (2026-04-28)
### Lighter Default Trashcan Color

Lightened the default `TrashIconButton` color from theme-aware `colors.textSecondary` (`#666` in light mode, `#a0aec0` in dark) to a hardcoded soft gray `#9ca3af` across both themes. The previous shade read too dark in the project / release row next to the blue **Edit** and **View Releases** buttons; the lighter gray matches the standardized SPERT® Suite trashcan look. Hover/focus state (red `#ef4444` icon + soft red background tile) is unchanged.

**Modified Files:**
- `src/shared/components/TrashIconButton.tsx` — `iconColor` now uses a hardcoded `#9ca3af` instead of `colors.textSecondary`. Removed the now-unused `colors` destructure from `useTheme()`.
- `src/shared/components/__tests__/TrashIconButton.test.tsx` — updated default-stroke assertion from theme-derived to hardcoded `#9ca3af`.
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — version-order expectation updated.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`.

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 17.1 (2026-04-28)
### Trashcan Icon for Destructive List Actions

Replaced the text **Delete** button on the Projects and Releases tabs, the **Remove** button in the project sharing dialog, and the snapshot delete button in the SnapshotBar with a single shared icon button. The trashcan is grayscale by default and turns red — with a soft red background tile — on hover or keyboard focus. Destructive actions now have a lower visual weight, matching the standardized SPERT® Suite look.

**New shared component:**
- `src/shared/components/TrashIconButton.tsx` — borderless icon button. Inline 20px SVG trashcan (Heroicons-style outline). Default color is theme-aware (`colors.textSecondary`); hover/focus color is `#ef4444` with a soft red background tile (`#fef2f2` light, `rgba(239,68,68,0.15)` dark). Hover state uses `useState` + `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`, matching the codebase's existing inline-style hover pattern (no new CSS). Props: `onClick`, `ariaLabel?`, `title?`, `disabled?`. Disabled state: 50% opacity, no hover transition.

**Call sites migrated (4):**
- `src/features/projects/ProjectsTab.tsx` — project Delete button (`aria-label="Delete project"`)
- `src/features/releases/ReleasesTab.tsx` — release Delete button (`aria-label="Delete release"`)
- `src/features/projects/ShareDialog.tsx` — member Remove button (`aria-label="Remove member"`)
- `src/features/chart/SnapshotBar.tsx` — Delete Snapshot button, replacing the previous emoji 🗑️ in a chip pill (`aria-label="Delete snapshot"`)

`ConfirmDialog` flows are unchanged at all four call sites — the second-tier safety net stays in place.

**Test updates:**
- New: `src/shared/components/__tests__/TrashIconButton.test.tsx` — 7 tests (renders SVG, default + custom aria-label/title, fires onClick, hover changes icon color, hover shows red background tile, disabled state)
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — `getByText('Delete')` → `getByRole('button', { name: 'Delete project' })` for the row button. ConfirmDialog's "Delete" button still queried by text (now unambiguous)
- `src/features/releases/__tests__/ReleasesTab.test.tsx` — same migration with `name: 'Delete release'`
- `src/features/projects/__tests__/ShareDialog.test.tsx` — `getByText('Remove')` → `getByRole('button', { name: 'Remove member' })`
- `src/features/chart/__tests__/SnapshotBar.test.tsx` — unchanged (uses `getByTitle('Delete this snapshot')`, which the new component preserves)

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Lint clean
- Production build succeeds with Turbopack
- Manual preview confirmed: grayscale → red-on-hover with pink tile background; ConfirmDialog still gates every action; light + dark mode both render correctly

---

## Version 17.0 (2026-04-26)
### Cloud Storage Modal

Standardized SPERT&reg; Suite Cloud Storage modal triggered by the header auth chip. Replaces the prior in-chip `ConfirmDialog` popover and the Settings-tab detour for sign-in. One dialog handles all three valid auth × storage states with sign-in, mode switching, Export Attribution, and the local-storage notification toggle. Settings tab retains its full cloud-storage section as a secondary entry point.

**New shared components and hook:**
- `src/shared/components/CloudStorageModal.tsx` — three-state modal (signed-out + local, signed-in + local, signed-in + cloud). Hand-rolled shell mirroring `TosConsentModal` (position fixed, backdrop, role=dialog, Escape, backdrop click, × button). Renders a `UploadConfirmFlow`, `<ExportAttributionSection>`, and `<LocalStorageWarningToggle alwaysVisible>` inside one card
- `src/shared/components/UploadConfirmFlow.tsx` — extracts the radio-click upload-confirm + post-upload cleanup-confirm pair from `StorageSection`. Imperative `requestCloudSwitch()` handle on a forwarded ref so both `StorageSection` and `CloudStorageModal` get identical behavior
- `src/shared/components/LocalStorageWarningToggle.tsx` — extracts the Notifications checkbox + `ganttapp-suppress-local-warning` write from `SettingsTab`. Optional `alwaysVisible` prop so the modal renders it regardless of storage mode while Settings retains the local-only behavior
- `src/shared/hooks/useSignInWithTosGate.ts` — encapsulates the load-bearing localStorage flag sequencing for ToS consent (`spert_tos_accepted_version` then `spert_tos_write_pending` then `signInWithPopup`). Optional `normalizeError` callback so the modal can silence `auth/popup-closed-by-user` and customize `auth/popup-blocked`. Placed in `src/shared/hooks/` rather than `src/features/settings/` because it's consumed by both a feature and a shared component — keeps the modal from importing from a feature folder

**Display-name normalization:**
- `normalizeDisplayName(displayName)` added to `src/shared/utils/displayName.ts`. Microsoft Entra ID returns "Last, First MI"; the helper returns "First MI Last". Used by the modal's identity card. Existing `getFirstName` / `getInitial` are unchanged.

**Sign-in error normalization in the modal:**
- `auth/popup-closed-by-user` — silent (no message)
- `auth/cancelled-popup-request` — silent
- `auth/popup-blocked` — "Allow pop-ups in your browser to sign in."
- All others fall through to `sanitizeFirebaseError`

**Auth chip rewire:**
- `StorageStatusChip` prop renamed `onSettingsClick` → `onOpenModal`. All three visual variants now route to the modal — single click target. Removed: `popoverOpen`, `signingOut`, `error` state, the Escape `useEffect`, both `ConfirmDialog` popover blocks, and the chip's direct call to `performSignOutWithCleanup`. Sign-out now lives inside the modal's identity card

**Settings refactor (single source of truth):**
- `SettingsTab` consumes `useSignInWithTosGate` instead of owning the gate inline. Notifications block replaced with `<LocalStorageWarningToggle colors={colors} />` (still local-mode-only by default)
- `StorageSection` consumes the new `<UploadConfirmFlow>` via a ref. Removed: inline `showUploadConfirm` / `showCleanupConfirm` / `statusMessage` state and matching `ConfirmDialog` blocks. Re-sign-in upload prompt and cloud→local keep/discard prompt remain as-is — those are global-context flows

**Layout integration:**
- `pages/index.tsx` hoists `cloudModalOpen` state at the `AppContent` level, passes `onOpenModal` to the chip, and renders `<CloudStorageModal>` after `<LocalStorageWarningBanner>`. The modal is rendered unconditionally and bails on `open=false` to avoid mount/unmount churn

**UX polish:**
- Export Attribution placeholders updated: name field shows "e.g., Jane Smith"; identifier placeholder typo fixed ("e.g," → "e.g.,"). Both Settings and modal pick up the change automatically (single component reuse)
- Modal's "Keep using local storage" secondary button (State 2 only) closes the modal without any storage-mode mutation — gives just-signed-in users a clear "leave me on local" affordance

**Modified files:**
- Auth chip: `src/shared/components/StorageStatusChip.tsx`
- Settings: `src/features/settings/SettingsTab.tsx`, `src/features/settings/StorageSection.tsx`, `src/features/settings/ExportAttributionSection.tsx`
- Entry: `pages/index.tsx`
- Utils: `src/shared/utils/displayName.ts`
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected files:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `styles/globals.css` — zero edits.

---

## Version 16.8 (2026-04-21)
### Snapshot Freezes Project-Override Labels

Small fix. When a user customized legend labels while a project was selected, v16.1 wrote the edit to that project's `legendLabels` override instead of to global state. The live chart rendered the override correctly (via `resolveLabel` in `useEffectiveChartProps`), but the snapshot-save path in `pages/index.tsx` `handleSaveSnapshot` pulled from the raw global label state and ignored project overrides. Result: snapshots froze the global baseline instead of what was displayed on screen.

**Fix:**
- `handleSaveSnapshot` now threads `selectedProject?.legendLabels` through `resolveLabel(key, projectLabels, globalOrDefault)` for all 5 keys. This is the same precedence the live chart uses, so snapshots now freeze exactly what the user sees
- Preserves v16.2 Risk 1 behavior: if both the project override and the global raw state are empty, the hardcoded `DEFAULT_LEGEND_LABELS` value still wins
- Dependency array updated to include `selectedProject?.legendLabels`

**Modified files:**
- Entry: `pages/index.tsx` — `handleSaveSnapshot` uses `resolveLabel`
- Tests: `src/features/chart/__tests__/useSnapshots.test.tsx` — new regression test alongside the existing v16.2 Risk 1 test, exercising the exact `resolveLabel(key, projectLabels, globalRaw || DEFAULT)` computation
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected files:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `globals.css` — zero edits.

**Tests:** 975 pass (974 + 1). All gates green (tsc, test, lint, build). Manually verified in preview: project with `legendLabels: { solidBar: "Custom Build Phase", mostLikelyLine: "Custom Target Date" }` produces a snapshot that freezes those custom labels, and viewing the snapshot renders `Custom Build Phase` in the legend.

---

## Version 16.7 (2026-04-20)
### SnapshotBar Mouse-Wheel Scroll + Snapshot Import Stale State

Two independent snapshot-bar fixes shipped together.

**Issue A — SnapshotBar horizontal mouse-wheel scroll:**
- On Windows with a standard vertical-wheel mouse, Chromium-family browsers did not reliably translate `deltaY` into horizontal scroll on containers whose only overflow axis is X. Users with many snapshots had no way to scroll back to newer chips without Shift-Wheel, a horizontal trackpad gesture, or clicking a partially-visible chip
- Fix: scoped native `wheel` listener on the `.snapshot-bar-scroll` viewport in `SnapshotBar.tsx`. When the container has horizontal overflow (`scrollWidth > clientWidth`) and the event has no horizontal component (`deltaX === 0`), redirects `deltaY` into `scrollLeft` and calls `preventDefault()` to stop the page from scrolling vertically
- Touchpad two-finger horizontal swipes (which emit real `deltaX`) are not intercepted — native horizontal scroll continues to handle them
- Uses a native `addEventListener('wheel', ..., { passive: false })` (not React's synthetic `onWheel`, which is passive by default and where `preventDefault()` is a no-op). Cleanup registered via `removeEventListener` in the effect return

**Issue B — Snapshot import stale state:**
- The import path in `applyImport` was calling `storage.saveSnapshots` directly, bypassing the `useSnapshots` hook entirely. Snapshots were persisted correctly but the in-memory `allSnapshots` state stayed stale, so the SnapshotBar UI did not reflect the imported snapshots until a page reload
- Fix: `ProjectsTab` now accepts an `onReplaceSnapshots` prop; `pages/index.tsx` passes `snapshotState.replaceAllSnapshots` (which was already built for exactly this purpose but had zero call sites). Storage and in-memory state now update atomically
- Orphan-snapshot fix: when the imported file has no `snapshots` key or an empty array, the code now explicitly clears existing snapshots (`replaceAllSnapshots([])`) rather than skipping the save. The import confirmation modal already authorizes replacement of all data including snapshots, so this aligns behavior with the modal text. Pre-v7.0 exports and legacy backups behave consistently

**Modified files:**
- Chart: `src/features/chart/SnapshotBar.tsx` (ref + wheel effect), `src/features/chart/__tests__/SnapshotBar.test.tsx` (+4 tests)
- Projects: `src/features/projects/ProjectsTab.tsx` (new `onReplaceSnapshots` prop, updated `applyImport`), `src/features/projects/__tests__/ProjectsTab.test.tsx` (+3 tests, updated `renderProjectsTab` default)
- Entry: `pages/index.tsx` (thread `snapshotState.replaceAllSnapshots` to `<ProjectsTab>`)
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected-file discipline:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `styles/globals.css` all have zero edits — verified via `git diff`.

**Tests:** 974 tests passing (up from 967 in v16.6), +7 net new. All gates green (tsc, test, lint, build).

---

## Version 16.6 (2026-04-19)
### Auth/Storage Security Audit Wave

**Security:**
- Centralized sign-out flow clears all in-memory AppData state (projects, releases, Export Attribution, legend labels, Prepared By, chart settings) on every sign-out path, including ToS-version-mismatch auto-signout. Closes the multi-account data-leak vector on shared browsers (findings A1-a, D4)
- Pending cloud writes are now cancelled (not flushed) at sign-out via new `cancelPendingSaves()` method, instead of committing stale edits with about-to-be-revoked credentials (A3)
- The switch-to-Cloud upload prompt now reads project count from AppDataContext in-memory state instead of directly from localStorage. Stale on-disk data from a previous user can no longer get silently uploaded to the current user's Firestore account (C3)
- ToS-version-mismatch auto-signout in AuthContext routes through the same centralized cleanup as user-initiated sign-out via a module-level callback registry (A6)
- Data-loss guard in AppDataContext now safely interacts with the centralized clear — previously it could preserve user A's data across a sign-out boundary (A1-b, C2)

**UX:**
- Header account pill gains a fourth state: **signed-in + local**. Avatar + first name + lock icon when the user is signed in but hasn't switched to Cloud. Clicking opens an account popover with "Switch to Cloud Storage" (navigates to Settings), "Sign Out", and "Cancel" (F2-d)
- Cloud→Local mode switch (while signed in with in-memory projects) now prompts: "Keep a local copy of your N cloud project(s)?" with **Keep Local Copy** and **Discard** buttons. Previously the switch silently persisted cloud data to localStorage (C4)
- Microsoft accounts whose display name comes back as "Last, First" now render their first name correctly in both signed-in pill states. Name-extraction logic extracted to `src/shared/utils/displayName.ts` as a shared single source of truth

**Fixes:**
- Concurrent sign-in popup collisions (`auth/cancelled-popup-request`) now show a clear message: "Another sign-in is already in progress. Please complete or cancel it first." (D1). Single-case surgical addition to `sanitizeFirebaseError` — 2 lines added, 0 deleted, no other edits to `validation.ts`
- Dead `ganttapp-has-uploaded-to-cloud` localStorage key removed. It was written but never read. A one-time migration `removeItem` runs during sign-out so existing v16.5 users get their browser cleaned up (E4)
- Terms of Service acceptance Firestore write now retries on next sign-in if the initial write fails. Previously a transient network error orphaned the user's local "accepted" state from a missing Firestore record, causing re-consent prompts in other SPERT Suite apps (TOS-WRITE-ORPHAN)

**Internal:**
- Two new module-level registries (`signOutCleanupRegistry`, `appDataResetRegistry`) bridge the AuthContext/StorageContext/AppDataContext provider layers without violating React's provider ordering. `AuthContext` can invoke `runSignOutCleanup()` from the ToS-failure path without importing `useStorage()`, and StorageContext's `performSignOutWithCleanup` can invoke `runAppDataReset()` without importing `useAppData()`
- New `cancelPendingSaves()` method on `GanttStorageService` interface. Local is a no-op; cloud clears the debounce timer and nulls pending data
- New `performSignOutWithCleanup()` on StorageContext. 8-step coordinated sequence: cancel pending cloud writes → clear in-memory state → dispose cloud service → reset storage mode key → swap to fresh local service → clear transition state → remove dead v16.5 key → firebase sign-out
- `clearAllData()` action on AppDataContext resets every state field; `isResettingRef` flag suppresses the save effect during the reset tick so cleared defaults are NOT written back to localStorage
- Save-executor error handler tightened: disposed service no longer re-queues `pendingData` on save error (A3-adjacent)

**Tests:** 967 tests passing (up from 931 in v16.5), +36 net new across 4 new test files and 3 modified. All gates green (tsc, test, lint, build). Protected files verified: `GanttChart.tsx` and `firestore-save-executor.ts` untouched; `validation.ts` shows exactly 2 added lines.

## Version 16.5 (2026-04-17)
### Hide SnapshotBar Scrollbar Chrome
- Fix: The horizontal scrollbar on the Gantt Chart's snapshot chip bar no longer renders as a gray bar overlaying the bottom of the chip buttons when a project has many snapshots. Scrolling by drag/wheel/keyboard still works unchanged; partially-visible chips at the right edge signal overflow
- Implementation: New `.snapshot-bar-scroll` CSS class in `styles/globals.css` applies `scrollbar-width: none` (Firefox) and `::-webkit-scrollbar { display: none }` (Chrome/Safari/Edge). Applied to the inner scroll viewport in `SnapshotBar.tsx`. Dropped the obsolete outer `height: 3rem` / `paddingBottom: 0.5rem` that v15.1 used to try to reserve space for the scrollbar
- Pattern: Matches the SPERT Scheduler v0.37.1 fix for the same class of issue on its scenario tab bar
- Tests: 914 tests pass (no new tests — visual CSS change only; existing `SnapshotBar.test.tsx` covers behavior)

## Version 16.4 (2026-04-17)
### Project Form Reflects Live Global Work Week + QRG Update
- Fix: The project form's Work Week selector now reflects the live global setting instead of a hardcoded Mon–Fri baseline when no project override exists. Changing Settings → Work Week (e.g. adding Saturday) now immediately shows as Mon–Sat on the Add Project form, not stale Mon–Fri
- API: New optional `fallbackDays` prop on `WorkWeekSelector`. Display priority is now `value ?? fallbackDays ?? [1,2,3,4,5]` — project override wins, else the caller-supplied live fallback, else the hardcoded default
- Wiring: `ProjectsTab` passes `fallbackDays={globalWorkDays}` so the project form's "no override" state always matches current global
- Docs: Updated `GanttApp_Quick_Reference_Guide.pdf` (repo root + `public/`) to the latest revision. The About tab links to the GitHub raw copy
- Tests: 4 new `WorkWeekSelector` fallback tests (fallback displayed, fallback preferred over Mon–Fri, value takes precedence, hardcoded fallback when both absent); 914 tests total, all passing

## Version 16.3 (2026-04-16)
### Work-Week Warnings Everywhere + Mon–Fri Default
- Default: `globalWorkDays` now initializes to `[1,2,3,4,5]` (Mon–Fri). First-time users and existing users whose stored data omits `globalWorkDays` receive the default automatically on first save. An explicitly-configured work week is preserved untouched
- Feature: Non-workday warnings now appear on **release list rows** (⚠ icon next to Start, Early, Late, Most Likely) with a hover tooltip
- Feature: Non-workday warnings now appear on **project list rows** (⚠ next to Finish Date) with a hover tooltip
- Feature: The **Project Finish Date** form input now shows an amber warning beneath it when the selected date falls outside the effective work week — parity with the release form
- Feature: **Chart date labels** (Start, Early, Late, Most Likely) render in amber bold when they fall on non-workdays, with an SVG `<title>` tooltip
- Feature: The **inline chart date editor** shows a non-workday warning beneath the input as you type, so you see the impact of an edit before saving
- Utility: New `DEFAULT_WORK_DAYS` constant exported from `validation.ts` — single source of truth for the Mon–Fri baseline, used as the initial state in `AppDataContext` and as the "Reset to default" target in Settings
- UX: Settings → Work Week description mentions the Mon–Fri default for new accounts; removed stale "(not persisted until you change it)" placeholder
- Threading: `workDays` prop added to `GanttChart` → `ChartReleaseBar`; `warning` prop added to `InlineDateEditor`
- Tests: 910 tests across 52 test files, all passing (2 test expectations updated for the new default behavior); TypeScript type-check clean (0 errors)

## Version 16.2 (2026-04-16)
### Default Legend Labels Editor + State-Model Refactor
- Feature: New "Default Legend Labels" section in Settings lets you customize the 5 global chart legend defaults (Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, In Progress). Closes the v16.1 UX gap where globals were unreachable once any project existed
- UX: Settings inputs start empty with hardcoded defaults shown as HTML placeholders. Clearing an input reverts to the placeholder default — no explicit reset button
- UX: Chart legend scope hint updated to reference "Settings → Default Legend Labels" for global edits
- UX: Italic styling removed on overridden legend labels. The ↺ reset button is the sole visual indicator of an active project override — mixed-italic rows looked inconsistent
- UX: Per-project reset buttons and the scope hint are now excluded from the "Copy Chart as Image" capture via the existing `copy-image-button` pattern
- Data: State model refactor — uncustomized global labels are no longer stored literally. First-time users have no `legendLabels` entries in local/cloud storage until they customize. Existing customizations load and render identically to v16.1
- Types: `sanitizeLegendLabels` return type relaxed (all 5 fields optional); `AppData.legendLabels`, `FirestoreSnapshot.legendLabels`, `FirestoreUserSettings.legendLabels`, and `Snapshot.legendLabels` sub-fields now optional
- New constant: `DEFAULT_LEGEND_LABELS` exported from `validation.ts` — single source of truth for placeholders + rendering fallback
- Risk-1 mitigation: `handleSaveSnapshot` now builds `legendLabels` from `raw || DEFAULT_LEGEND_LABELS.key` so snapshots freeze the effective displayed label, never empty strings. Dedicated regression test in `useSnapshots.test.tsx`
- Wave 1 gate: `npx tsc --noEmit` enforced before the state-model refactor. Caught a third `legendLabels` type occurrence (Snapshot.legendLabels) the plan missed, and a latent test-wrapper typing issue in v16.1
- 908 tests across 52 test files, all passing (15 net new tests); TypeScript type-check clean (0 errors)

## Version 16.1 (2026-04-16)
### Per-Project Legend Label Overrides
- Feature: Each project can now override any of the five chart legend labels (Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, In Progress). Global labels remain the baseline
- UX: Labels with project overrides render in italic with a ↺ reset button. One-line hint above the legend clarifies edit scope when a project is selected
- UX: Edits save to the current project when a project is selected; save globally when no project is selected. Edit boxes open with the effective value — project override if present, otherwise global
- Data: Per-project overrides persist in local and cloud storage; round-trip through JSON export/import; projects without overrides behave identically to v16.0
- Resolver: New `resolveLabel` utility — single source of truth for precedence (snapshot → project override → global). Used by both render path and edit UI so the two can never disagree
- Risk mitigation: `contentChanged` in `firestore-save-executor.ts` updated to compare `legendLabels` — prevents silent write-skip in cloud mode (same class as v12.5 reorder and v15.0 workDays bugs). 6 dedicated regression tests added
- 893 tests across 51 test files, all passing (49 net new tests); TypeScript type-check clean (0 errors)

## Version 16.0 (2026-04-16)
### Release Status (three-state) + Today's Date Label
- Feature: Replaced two-state completed toggle with three-state release status — Not Started, In Progress, and Complete — exposed via a segmented control in the release list
- Feature: Added a customizable In Progress bar color to Chart Settings and all 10 color presets (default: amber #f59e0b)
- Feature: Added today's date label above the Today vertical line on the Gantt chart, using the line's color and short-format date (e.g. "Apr 15")
- UX: In Progress legend entry appears on the chart when any release has in-progress status
- UX: The "In Progress" legend label is now editable in place, consistent with Solid Bar, Hatched Bar, Project Finish Date, and Most Likely Finish
- UX: Legend entries reorder left-to-right to match status progression: Completed → In Progress → Not Started (solid + hatched) → vertical lines
- UX: Chart legend wraps gracefully when many entries are visible (gap reduced, flex-wrap added)
- UX: Chart Settings color picker grid narrowed to fit the new In Progress swatch without adding a row
- Migration: Existing releases with `completed: true` automatically migrate to `status: 'complete'` on load at all four ingestion points (localStorage, Firestore, JSON import, snapshots). Snapshots migrate at read time — stored data is untouched until rewritten
- Risk mitigation: `releaseChanged` diff check updated to compare `status` instead of `completed` — without this, a status change in cloud mode wouldn't trigger a Firestore write (same class as v12.5 reorder / v15.0 workDays bugs); dedicated regression test added
- 844 tests across 51 test files, all passing (31 net new tests); TypeScript type-check clean (0 errors)

## Version 15.3 (2026-04-15)
### Security Audit Fixes
- Security: Sanitized Firestore-loaded snapshot names and release names in firestoreSnapshotToFlat() via sanitizeString(), matching existing project/release converter pattern
- Security: Replaced full error object logging with sanitized messages across 14 console.error() call sites (7 files); prevents Firestore paths and SDK internals from leaking to browser console
- Security: Added email format validation (@ check) in ShareDialog before Firestore lookup for immediate feedback on invalid input
- Audit scope: v15.0 work-week sanitization paths (6 ingestion points verified), v15.1 snapshot optimistic updates (sanitization chain verified), Firestore rules (document-level auth confirmed for new fields), general XSS/injection/secrets scan (no issues)

## Version 15.2 (2026-04-15)
### Refactoring & Label Fix
- Refactor: Extracted ReleaseFormFields component from ReleasesTab (506 → 360 LOC) for independent testability and reduced token cost
- UX: Unbolded parenthetical text in "Finish Date (Optional)" and "Work Week (Optional Override)" labels
- Code quality: Reviewed all post-v13.0 modules; audited all dependencies against 60-day stability window (no upgrades — all within window)
- 813 tests across 50 test files, all passing; TypeScript type-check clean (0 errors)

## Version 15.1 (2026-04-15)
### Snapshot Bar Fixes
- UX: Moved Save Snapshot and Delete Snapshot buttons to the left side of the snapshot bar so they are always visible without scrolling
- UX: Snapshots now sort newest-first so the most recent snapshot always appears immediately after "Current"
- Fix: Fixed horizontal scrollbar overlapping snapshot bar chips by adding padding for the scrollbar track
- Fix: Fixed cloud storage mode overwriting snapshots instead of accumulating them by using optimistic state updates (state-level bug — Firestore documents were always unique)
- Fix: Resolved all pre-existing TypeScript type-check errors in test files (missing ChartColors properties, spread argument types, type casts)
- 808 tests across 49 test files, all passing; TypeScript type-check clean (0 errors)

## Version 15.0 (2026-04-15)
### Work Week Configuration
- Feature: Added a global work-week setting in the Settings tab — pick which days of the week count as workdays using a toggleable 7-chip selector (S M T W T F S)
- Feature: Added a per-project work-week override in the Project form, falling back to the global default when not set
- UX: Release date fields in the Releases tab now show an amber warning when a date falls outside your work week; saves are still allowed — warnings are informational
- Component: New `WorkWeekSelector` shared component with accessible labels (aria-pressed, aria-label) and a "last chip disabled" invariant ensuring at least one day is always selected
- Data: Work-week data (`Project.workDays`, `AppData.globalWorkDays`) persists in both local and cloud storage and round-trips through JSON export/import
- Firestore: `workDays` field added to `ganttapp_projects/{projectId}`; `globalWorkDays` added to `ganttapp_settings/{uid}`. No security-rule changes required (document-level auth, not field-level)
- UX: Project form layout — work-week chips sit inline beside the finish date instead of on a separate row
- UX: Renamed "Project Finish Date" label to "Finish Date" and "Export" button to "Export All" for clarity
- Code quality: Fixed all pre-existing lint errors (8 issues across 6 files) — removed stale eslint directives, converted effect-based derived state to render-time derivation, replaced setState-in-effect with lazy initializers where SSR-safe

## Version 14.0 (2026-04-09)
- UX: Unified the header auth chip into a single click target. Clicking anywhere on the pill (avatar, name, or cloud icon) now opens an account popover when signed in to cloud storage
- UX: Account popover shows display name + email and exposes a Sign Out button directly from the header — no more navigating to Settings to sign out
- UX: Signed-out chip behavior unchanged: clicking anywhere on the pill opens the Settings tab to start the sign-in flow
- A11y: Chip is now a single `<button>` with `aria-haspopup`, `aria-expanded`, and a descriptive `aria-label`; Escape dismisses the popover
- Reliability: Sign Out uses a loading state with re-entry guards so the popover cannot be dismissed mid-await

## Version 13.9 (2026-04-05)
- **Legal** — Updated Terms of Service and Privacy Policy to v04-05-2026
- **Legal** — Added SPERT® AHP to list of covered apps
- **Legal** — Updated effective date to April 5, 2026

## Version 13.8 (2026-04-04)
- **UX** — Added storage & auth status chip in the upper-right header: shows a "Local" pill (with database icon) in local storage mode, and a user avatar initial + display name + cloud icon in cloud mode; clicking navigates to Settings

## Version 13.7 (2026-04-02)
- UX: Added amber warning banner on every app load when using local storage mode, reminding users to export their data; dismissible per session via "Got it" button
- Settings: New "Notifications" section with a checkbox to permanently suppress the local storage warning banner (visible only in local storage mode)

## Version 13.6 (2026-03-31)
- Legal: Updated Terms of Service and Privacy Policy (effective March 31, 2026); triggers re-consent for Cloud Storage users
- Legal: Updated canonical legal document URLs to spertsuite.com
- UI: Updated consent UI text to SPERT Suite branding
- UI: Added License link to footer

## Version 13.5 (2026-03-24)
- UX: Inline edit form on Releases tab — clicking Edit shows the form below the release instead of at the top of the page
- Chart: New "Show Months" toggle in Chart Settings renders abbreviated month labels and thin vertical separators
- Chart: Renamed "Show Project Finish Date" to "Show Finish Date" in Chart Settings
- Export: JSON export filename prefix changed from "gantt-data" to "ganttapp-export"
- UI: Improved footer spacing between copyright row and legal links

## Version 13.4 (2026-03-20)
- Legal: Updated Terms of Service and Privacy Policy (effective March 20, 2026); triggers re-consent for Cloud Storage users

## Version 13.3.1 (2026-03-16)
- UX: Updated first-run banner text to clarify browsewrap agreement

## Version 13.3 (2026-03-11)
- Infrastructure: Pinned Node.js target to v22 LTS; added engines field, .nvmrc, updated @types/node

## Version 13.2 (2026-03-11)
- Security: Added sanitizeString() to inline chart editing (release names and legend labels)
- Security: Sanitized Firestore-loaded project and release names in converters
- Security: Removed user email interpolation from sharing error messages
- Security: Sanitized raw Firestore error in cloud mode-switch via sanitizeFirebaseError()
- Security: Added maxLength to project name, release name, and share email inputs
- Security: Applied sanitizeString() to share email and duplicate release name at point of entry

## Version 13.1 (2026-03-11)
- Replaced all remaining window.confirm() calls with styled ConfirmDialog component (project delete, release delete, member removal, snapshot delete)
- Updated dependencies: @types/react 19.2.14, @vitejs/plugin-react 5.1.4, eslint 9.39.4, firebase 12.10.0, firebase-tools 15.9.1
- Synced package.json version to 13.1.0

## Version 13.0 (2026-03-11)
- Added Terms of Service and Privacy Policy links to persistent footer (browsewrap notice)
- Added first-run informational banner for new users (dismissible, non-blocking)
- Added clickwrap consent modal required before enabling Cloud Storage (checkbox + links)
- Added ToS acceptance record in Firestore (users/{uid}) with version tracking
- Added returning-user ToS version check on auth state change (sign-out on mismatch)
- Centralized version constants in src/lib/version.ts (APP_VERSION, TOS_VERSION, APP_ID)
- Added legal/ directory with reference copies of ToS and Privacy Policy PDFs
- Added README.md with Legal section
- Synced package.json version to 13.0.0

## Version 12.6 (2026-03-09)
- **Improvement** — Added copyright headers to all 117 human-authored source files (GNU GPL v3 attribution)
- **Improvement** — Strengthened LICENSE file with author attribution block and Section 7 additional terms (Attribution Preservation, UI Notice Preservation)

## Version 12.5 (2026-03-09)
- **Bug Fix** — Drag-and-drop release reordering now persists to Firestore in cloud mode (was silently lost on reload because diff-based saves only checked content fields, not array position)
- **Bug Fix** — Drag-and-drop project reordering now persists to Firestore in cloud mode (added `order` field to project documents)

## Version 12.4 (2026-03-08)
- **Docs** — Added Quick Start Guide section to the About tab with a downloadable PDF covering project creation, releases, chart reading, and snapshots

## Version 12.3 (2026-03-08)
- **Bug Fix** — Cloud sync no longer replaces local data with empty cloud results — guards added to both initial load and real-time sync to prevent silent data loss
- **Bug Fix** — “Skip — Connect Without Uploading” replaced with “Cancel” that stays in local mode, preventing data loss when cloud has no data
- **UX** — Cancelling the upload prompt during re-sign-in now reverts stored mode to local instead of switching to cloud without data

## Version 12.2 (2026-02-22)
- **Security** — Firebase error messages are now sanitized before display, preventing internal details (project IDs, collection paths) from leaking to the UI
- **Security** — Project `owner` field from Firestore is now sanitized with `sanitizeId()` to prevent injection of control characters or oversized strings
- **Security** — User profile data (displayName, email) is now sanitized with `sanitizeString()` before writing to Firestore (defense-in-depth)
- **Security** — Project names in error messages are now sanitized to prevent control character injection
- **Tests** — Added 10 new security tests: sanitizeFirebaseError (6), owner sanitization (2), StorageContext error handling (2). Total: 696 tests across 45 files

## Version 12.1 (2026-02-22)
- **Bug Fix** — “Skip — Connect Without Uploading” now correctly connects to cloud without uploading local data (was triggering upload)
- **Bug Fix** — Skipping the upload prompt now persists the cloud mode preference (was re-prompting on every reload)
- **Bug Fix** — Fixed `as any` type cast in cloud storage service (now uses proper `FirestoreSnapshot` type)
- **Refactor** — Created shared `ConfirmDialog` component for inline and modal confirmation dialogs, reducing code duplication across StorageSection and ProjectsTab
- **Tests** — Added 47 new tests: ConfirmDialog (13), StorageSection (30), StorageContext (4). Total: 686 tests across 45 files

## Version 12.0 (2026-02-22)
- **Architecture** — Cloud is now the source of truth: switching to local no longer downloads cloud data (one-way upload only)
- **Feature** — Existence-based dedup: re-uploading projects that already exist in the cloud are automatically skipped, preventing duplicates
- **Feature** — Post-upload cleanup dialog prompts users to clear local copies after successful cloud upload
- **Feature** — Smart re-sign-in: detects local projects on cloud mode restoration and prompts to upload or skip
- **Feature** — “Download All Projects as JSON” button in cloud mode for backup and portability
- **UX** — Sign-out no longer downloads data — flushes pending writes and switches to local mode cleanly
- **Robustness** — Network errors during upload are surfaced to the user instead of silently creating duplicate projects

## Version 11.3 (2026-02-21)
- **UX** — Cloud storage radio button now disabled until user signs in (was showing an error after click)
- **UX** — Sign-in buttons moved into the Storage section with helper text “Sign in to enable cloud storage and sharing”
- **Refactor** — AccountSection merged into StorageSection for a more intuitive settings layout

## Version 11.2 (2026-02-20)
- **Security** — Sharing functions now enforce owner-only access (prevents editors from adding/removing project members)
- **Security** — All user text inputs sanitized at point of entry via `sanitizeString()` (project names, release names, snapshot names, export attribution, Prepared By)
- **Security** — HTTP security headers added: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **UI** — Share button now only visible to project owners in cloud mode
- **UI** — Export attribution inputs now have `maxLength` enforcement

## Version 11.1 (2026-02-20)
- **Bug Fix** — export attribution now persists correctly in cloud mode (was lost on save/load)
- **Bug Fix** — “Prepared By” field can now be cleared to empty in cloud mode
- **Bug Fix** — changing export attribution now triggers cloud save
- **Refactor** — ChangelogTab converted to data-driven rendering (512 → ~50 LOC component + data file)
- **Refactor** — FirestoreGanttStorageService decomposed into focused modules (559 → ~280 LOC)
- **Refactor** — StorageContext switchMode logic extracted to standalone functions (217 → 105 LOC)
- **Refactor** — SettingsTab split into StorageSection, AccountSection, and ExportAttributionSection sub-components
- 35 new tests across 2 new test files; total test count: 616 across 40 files

## Version 11.0 (2026-02-20)
- Added Firebase Authentication with Google and Microsoft SSO (AuthContext)
- Added Firestore cloud storage backend (FirestoreDriver, FirestoreGanttStorageServiceImpl)
- Added StorageContext with local ↔ cloud mode switching and data migration
- Added Settings tab: storage mode selector, account management, export attribution
- Added real-time sync via Firestore onSnapshot with echo prevention (hasPendingWrites)
- Added project sharing with role-based access control (owner/editor/viewer) via ShareDialog
- Added Firestore security rules (firestore.rules)
- Added export attribution: name/identifier injected as _exportedBy in JSON exports
- Added origin and edit history on cloud-stored projects: _originRef records the account that created the project, and _changeLog keeps a rolling audit trail of edits (capped at 50 entries, oldest dropped)
- Updated About page with dual-storage messaging (Local Storage default, Cloud Storage optional)
- Tab order: Projects, Releases, Gantt Chart, Settings, About
- Provider hierarchy: AuthProvider > StorageProvider > ThemeProvider > AppDataProvider
- 581 tests across 38 test files, all passing

## Version 10.0 (2026-02-18)
- Added storage abstraction layer: StorageDriver and GanttStorageService interfaces
- Added LocalStorageDriver and LocalGanttStorageService (refactored from direct localStorage)
- Added StorageContext providing pluggable storage to the component tree
- Added Firebase SDK (firebase ^12.9.0) with conditional initialization
- Added .env.local.example template for Firebase configuration
- All snapshot operations now async via GanttStorageService
- AppDataContext consumes useStorage() instead of direct localStorage calls
- Zero functional changes — all existing features work identically
- 497 tests across 32 test files, all passing

## Version 9.0 (2026-02-16)
- Added import safety dialog: confirmation shown after file parse, before data apply
- Added customizable completed release color (completedBar property in ChartColors)
- Completed releases render as single solid bar from startDate to lateFinishDate (no hatching)
- Early Finish and Most Likely labels hidden for completed releases
- Added darkenColor() utility for computed hatched bar colors
- Hatched Bar color picker swatch now displays with SVG hatched pattern
- Color picker labels renamed for clarity (Today → Today's Date, etc.)
- 459 tests across 28 test files, all passing

## Version 8.0 (2026-02-13)
- Added optional Most Likely Finish Date per release (vertical line in hatched bar)
- Added global toggle: Show Most Likely Finish (in Chart Settings)
- Added configurable Most Likely line color with color picker
- Added click-to-edit inline on chart for Most Likely date
- Added editable Most Likely legend entry
- Smart label suppression for Most Likely date (40px threshold)
- All 10 color presets updated with Most Likely line color
- Snapshots capture Most Likely data per-release
- Fixed showTodayLine toggle persistence to localStorage
- Fixed onKeyPress (deprecated) to onKeyDown in ProjectsTab
- Fixed dark mode colors in ChartSettings preset buttons
- Fixed saveLabelEdit() to reject empty/whitespace-only labels
- Added shared validateReleaseDateChange() and formatDateLocale() utilities
- 447 tests across 26 test files, all passing

## Version 7.1 (2026-02-09)
- Internal refactoring for maintainability — zero functional changes
- Extracted 5 shared sanitization functions into validation.ts (DRY)
- Updated useChartCalculations hook with correct constants and displaySettings parameter
- Reduced GanttChart from 52 individual props to 9 grouped props
- Extracted ChartReleaseBar component from GanttChart (~150 LOC)
- Extracted useEffectiveChartProps hook for snapshot vs live data resolution
- Added 66 new tests across 6 test files
- 393 tests across 22 test files, all passing

## Version 7.0 (2026-02-09)
- Added Release Plan Snapshots: save read-only historical records of release plans
- Chip navigation bar above chart to toggle between Current and saved snapshots
- One-click snapshot creation with optional custom name
- Snapshots capture releases, chart colors, legend labels, project finish date, Prepared By
- Historical snapshots are fully read-only (inline editing disabled)
- Delete old snapshots with confirmation dialog
- Cascade delete: project deletion removes all its snapshots
- Export/Import includes snapshots in JSON file
- Separate localStorage key (ganttAppSnapshots) for data isolation
- Limits: 100 total snapshots, 50 per project, 2MB import file size cap
- Added Prepared By field in Chart Settings with show/hide toggle
- Fixed quarter label (Q4) overlapping year label
- Fixed horizontal scrollbar on Windows Chrome/Edge
- 322 tests, all passing

## Version 6.1 (2026-02-07)
- Added Row Spacing control in Chart Settings with S/M/L options (20px, 25px, 30px)
- Row height formula changed from barHeight * 2 to barHeight + rowSpacing
- Bar Height labels changed to S/M/L for compact display
- 320 tests, all passing

## Version 6.0 (2026-02-06)
- Added click-to-edit dates directly on chart (inline date picker with validation)
- Added configurable Bar Height in Chart Settings (Small/Medium/Large)
- Compact horizontal layout for PresetButtonGroup controls
- 289 tests, all passing

## Version 5.7 (2026-02-06)
- Added Duplicate Release (one-click cloning with auto-shifted dates)
- Added keyboard shortcuts: Escape (cancel), Ctrl/Cmd+S (save), Arrow keys (tab navigation)
- Added dark mode with light/dark/system toggle (ThemeContext)
- Theme stored in separate localStorage key (gantt-theme)
- All components updated with theme-aware styling
- 288 tests, all passing

## Version 5.6 (2026-02-03)
- Added comprehensive input sanitization for all user-provided and imported data
- Added sanitizeString(), sanitizeId(), isValidHexColor(), sanitizeColor() to validation.ts
- Added file size limit (1MB), array limits (50 projects, 500 releases) on import
- Added validateLoadedData() defense-in-depth for localStorage
- npm audit: 0 vulnerabilities

## Version 5.5 (2026-02-02)
- Upgraded Next.js from 15.5.11 to 16.1.6 (major version upgrade)
- Turbopack is now the default bundler (faster builds)
- Removed ESLint bridge packages (@eslint/compat, @eslint/eslintrc, @eslint/js) — eslint-config-next@16 exports native flat config
- Simplified eslint.config.mjs to use native Next.js 16 flat config directly
- Removed obsolete eslint config block from next.config.js
- Refactored project auto-selection from useEffect to computed value (fixes react-hooks/set-state-in-effect)
- Removed unused useEffect import from main page
- npm audit: 0 vulnerabilities — fully JFrog scan ready
- All 288 tests pass, build succeeds, lint clean

## Version 5.4 (2026-02-02)
- Upgraded Next.js from 14.2.35 to 15.5.11 (major version upgrade)
- Upgraded React from 18 to 19 and React DOM from 18 to 19
- Updated @types/react and @types/react-dom to v19
- Migrated Context.Provider to React 19 direct Context syntax
- Aligned eslint-config-next to 15.5.11 to match Next.js version
- Resolved all Next.js 14 CVEs (GHSA-h25m, GHSA-9g9p) by upgrading to 15.x
- All 288 tests pass on React 19 with zero code changes required

## Version 5.3 (2026-02-02)
- Upgraded ESLint from v8 to v9 to resolve moderate security vulnerability (GHSA-p5wg)
- Upgraded eslint-config-next from 14.0.4 to 15.1.7 for ESLint 9 compatibility
- Migrated to ESLint flat config format (eslint.config.mjs) for forward compatibility
- Added ESLint bridge packages (@eslint/js, @eslint/eslintrc, @eslint/compat)
- Fixed 21 unescaped entity lint errors across JSX components
- Changed lint command from "next lint" to "eslint ." for ESLint 9 support
- Reduced npm audit vulnerabilities from 5 to 1 (remaining: Next.js CVE that does not apply to Pages Router)

## Version 5.2 (2026-02-01)
- Expanded automated test suite from 157 to 288 tests across 19 test files
- Added tests for useProjects hook: CRUD operations, form state, cascade delete (23 tests)
- Added tests for useReleases hook: CRUD operations, validation, toggle operations (27 tests)
- Added tests for ProjectsTab component: rendering, form, edit/delete, navigation, validation (20 tests)
- Added tests for ReleasesTab component: rendering, project selection, form, toggles (18 tests)
- Added tests for UI components: Tabs, DragHandle, ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup (34 tests)
- Added tests for static pages: AboutTab and ChangelogTab (9 tests)

## Version 5.1 (2026-01-29)
- Added automated test suite with 157 tests across 8 test files (Vitest + React Testing Library)
- Fixed date validation bug: invalid calendar dates (e.g., Feb 30, Month 13) are now rejected
- Fixed timezone inconsistency: date comparisons now use local timezone consistently
- Fixed potential ID collision by replacing Date.now() with unique ID generator
- Improved data import validation: projects and releases are now schema-validated on import
- Fixed chart rendering edge case when all release dates are identical
- Consolidated duplicate localStorage save effects in state management
- Removed unused useLocalStorage hook (dead code cleanup)
- Fixed date input placeholder styling: empty inputs show mm/dd/yyyy in light gray, entered values in dark color
- Copy chart as image button now excluded from captured images
- Improved inline "Releases for" dropdown styling on Releases tab

## Version 5.0 (2026-01-22)
- Complete architectural refactoring to Feature Modules pattern
- Extracted utilities, types, and components for better maintainability
- Reduced token usage for AI-assisted development by 75-85%
- Improved code organization with feature-based folder structure
- Created centralized context for state management
- All features work identically - zero functional changes for users

## Version 4.4 (2026-01-21)
- Enhanced Chart Settings with configurable display options
- Added Release Name Font Size control: Small (14px), Medium (16px), or Large (18px)
- Added Date Label Font Size control: Small (9px), Medium (11px), or Large (13px)
- Added Date Label Color control: grayscale swatches from light gray to black for better contrast
- Added Vertical Line Width control: Thin (2px), Medium (3px), or Thick (4px) for Today's Date and Project Finish Date lines
- Display controls positioned horizontally for better visibility
- Increased left margin space for release names and optimized chart layout
- Legend line segments now match vertical line width setting
- All display settings persist to localStorage and survive export/import

## Version 4.3 (2026-01-21)
- Added release visibility toggle: hide releases from chart while keeping them in the list
- Added completion status: mark releases as done to render them in green
- Enhanced Releases tab with "Show" checkbox and "Mark Done" button for each release
- Completed releases display in light green (solid) and forest green (hatched)

## Version 4.2 (2026-01-20)
- Added optional project finish date field (Projects tab)
- Renamed "Chart Color Settings" to "Chart Settings"
- Moved chart display toggles to Chart Settings section (cleaner exported images)
- Added project finish date vertical line visualization (bright green by default)
- Added quarter labels (Q2, Q3, Q4) to timeline above vertical gridlines
- Enhanced Chart Settings with toggle controls and finish date color picker

## Version 4.1 (2026-01-20)
- Removed "Gantt Chart:" label prefix from chart display (project name only)
- Added collapsible color settings section (collapsed by default)
- Made legend labels editable with localStorage persistence
- Enhanced About page formatting (bolded "GanttApp" in description)

## Version 4.0 (2026-01-19)
- Revert from Firebase to localStorage for better data persistence
- While Firebase provided cloud storage, anonymous authentication sessions expired unpredictably
- localStorage puts users in control - data persists until they choose to clear their browser cache
- Export/Import feature provides reliable backup mechanism

## Version 3.5 (2026-01-19)
- Add configurable chart colors with preset themes
- Users can now customize solid bar, hatched bar, and today's line colors
- Includes preset color themes: Classic Blue, Ocean Green, Purple Haze, Sunset Orange, Ruby Red

## Version 3.4 (2026-01-19)
- Add intelligent label hiding on Gantt chart to prevent overlapping date labels

## Version 3.3 (2026-01-19)
- Add real-time validation for project names, release names, and date logic

## Version 3.2 (2026-01-19)
- Add Change Log accessible via footer link

## Version 3.1 (2026-01-18)
- Fix timezone bug in date display

## Version 3.0 (2026-01-18)
- Initial release with Firebase integration
- Project and release management
- Gantt chart visualization with uncertainty ranges

## Version 2.1 (2026-01-17)
- Add copyright footer and GNU GPL v3 license

## Version 2.0 (2026-01-17)
- Add Export/Import functionality and copy chart as image

## Version 1.0 (2026-01-17)
- Initial release with localStorage, Projects, Releases, and Gantt chart
