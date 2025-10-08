# [minchat](https://minchat-nostr.vercel.app)

Minchat is a simple hybrid nostr client that can do a few things that most nostr clients don't.

MinChat supports proof-of-work, simple end-to-end encryption (E2EE) for channels by using AES-GCM, and a bunch of other neat features. You can even buy things on minchat if you put a bit of effort into it!

## What is Nostr?

Nostr is a protocol that lets clients/apps receive and send messages (events) through relays. It is a very simple protocol, and is designed to be censorship-resistant.

Theoretically, any kind of app can be built on top of nostr, however, the protocol is still in its early stages, and most apps have opted to clone twitter (which is fitting, since Jack Dorsey is a prominent supporter of nostr).

Nostr event kinds are similar to ports in TCP/IP. They allow clients/apps/relays/bots/etc to filter events based on what kind of event they are interested in receiving or sending. A full list of event kinds can be found [here](https://nostrdata.github.io/kinds/).

## Nostr Event Kinds Supported

- 1059: Gift-Wrapped DMs
  - sending & receiving
- 30023: Longform Posts
  - receiving only
- 30818: Wiki Posts & Edits
  - receiving only
- 30402: Classified Listings
  - receiving only
- 20000/23333: Bitchat
  - sending & receiving
- 1: Nostr Notes
  - sending & receiving

![Image Example 1](/public/images/example3.jpg)

Implementations of each even kind can be improved. I welcome suggestions and contributions.

Some event kinds are currently receive only. I plan to eventually add the ability to send all supported event kinds, but I probably will not get around to it for a while. Again, feel free to open a pr. Thanks.

## Relay Limitations

The duration of time that relays keep events varies widely.
Rate-limiting also differs from relay to relay.
Paid relays won't let you post to them for free, obviously.
There is no popular bridging protocol or any sort of cross-relay communication.
There is no dedicated kind of event for game packets or other real-time data besides the free-for-all ephemeral ones.

For these reasons I am strongly considering writing my own relay that stores giftwrapped DMs and longform posts indefinitely, and possibly a few other event kinds as well, but not bitchat. This functionality would make it somewhat useful for groups and communities to use minchat.