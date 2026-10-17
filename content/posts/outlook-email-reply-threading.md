---
title: outlook email reply threading
date: 2026-10-17
# updated:
---

\.\.\.is header-based. You might run into issues sending threaded replies to Outlook users programatically because the headers it uses for this are nonstandard. [RFC 5322](https://datatracker.ietf.org/doc/html/rfc5322) defines a much simpler, but more limited, standard for reply threading.

The `Thread-Topic` header is self explanatory

The `Thread-Index` header is base64-encoded binary data which contains a header struct + 1 struct per additional reply to the thread

Header struct format:

| Byte range (inclusive, little-endian numbering) | Contents |
| --- | --- |
| 0 | 0x01 |
| 1-5 | high 40 bits of a Windows `FILETIME` |
| 6-21 | thread GUID |

A Windows `FILETIME` is an unsigned 64 bit integer counting the number of 100ns intervals since 00:00 1 January 1601 UTC

Reply struct format:

| Bit range (inclusive, little-endian numbering) | Context |
| --- | --- |
| 0 | Delta code |
| 1-31 | Time delta |
| 32-39 | Random 8 bits |

To populate the reply struct, first we need to subtract the root email `FILETIME` from the reply  `FILETIME` to produce the time difference. Then (using big-endian bit numbering here):

The delta code is set to 0 if no bit more significant than bit 48 is set. Otherwise it is set to 1. This corresponds to time differences greater than about 1.7 years having a delta code of 1.

If the delta code is set to 0, right-shift the time difference by 18 bits and store the low 31 bits of the result as the time delta.

If the delta code is set to 1, right-shift the time difference by 23 bits and store the low 31 bits of the result as the time delta

This allows us to store a larger range of time differences at the expense of worse precision for time differences larger than 1.7 years.
