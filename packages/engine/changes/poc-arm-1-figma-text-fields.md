---
engine: minor
---
A boolean component property can now be pinned (#4461). `figmaProperties.booleans[*].pinnedShownAt` names the variant coordinates where the part is built visible and not wired to the switch. TextField and PasswordField pin their message at every validation status (error, warning, success), so in Figma, as in code, the message shows there whatever the message switch says. The set default stays off. Both component executors leave the pinned node unwired, an Update over an older file takes the old reference off, and the read-back fails a pinned node that is wired or hidden. The two fields exempt status from the footprint check, because the pinned members are taller.
