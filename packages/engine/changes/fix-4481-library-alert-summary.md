---
engine: patch
---
Update file's library callout is one line that counts the changes by what they do to files that use the library, and
names each kind's sets, for example "12 changes reach files that use this library: 8 break their instances (Button), 4
are retired (Select)." Show the changes opens the full list in a short box that scrolls, so a long list no longer pushes
the dialog's steps out of view (#4481). The plugin's update check now sends each set's changes counted by kind. No
committed artifact changes.
