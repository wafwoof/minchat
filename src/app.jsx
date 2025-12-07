import './app.css';
import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Analytics } from "@vercel/analytics/react";
import { generateSecretKey, getPublicKey, finalizeEvent, SimplePool, nip13 } from 'nostr-tools';
import { encrypt, decrypt, hexToNpub } from './encryption.js';
// import { Lock, Settings, SendHorizontal, Pickaxe, Image, Telescope, ShoppingCart, Inbox, Copy, Trash2 } from 'lucide-preact';
import ChatTab from './tabs/chat/Chat.jsx';
import LanderTab from './tabs/lander/Lander.jsx';
import SettingsTab from './tabs/settings/Settings.jsx';
import ExploreTab from './tabs/explore/Explore.jsx';
import MarketTab from './tabs/market/Market.jsx';
import DmTab from './tabs/dm/Dm.jsx';

const config = {
  version: '0.0.6',
  revision: '2025-10-18',
  simplePool: { 
    enablePing: false, 
    enableReconnect: true 
  },
  relays: {
    main: [
      'wss://economics-grain-soup-diana.trycloudflare.com',
      // 'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      // 'wss://commission-collect-shore-genius.trycloudflare.com',
      'wss://relay.damus.io', 
      'wss://relay.nostr.band', 
      'wss://nostr-relay.zimage.com',
      'wss://offchain.pub',
      // 'wss://articles.layer3.news',
      // 'wss://relay-testnet.k8s.layer3.news'
    ],
    wiki: [
      'wss://economics-grain-soup-diana.trycloudflare.com',
      // 'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      // 'wss://commission-collect-shore-genius.trycloudflare.com',
      'wss://nos.lol',
      'wss://relay.wikifreedia.xyz',
      'wss://relay.nostr.band',
    ],
    market: [
      'wss://economics-grain-soup-diana.trycloudflare.com',
      // 'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      // 'wss://commission-collect-shore-genius.trycloudflare.com',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://purplepag.es',
      'wss://relay.primal.net',
      'wss://relay.nostr.band'
    ],
    dm: [
      'wss://economics-grain-soup-diana.trycloudflare.com',
      // 'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      // 'wss://commission-collect-shore-genius.trycloudflare.com',
      // 'wss://relay.mostr.pub',
      'wss://relay.damus.io',
      // 'wss://relay.primal.net',
      // 'wss://nos.lol',
    ]
  },
  kind1Channels: ['nostr', 'tech', 'news', 'politics', 'netsequé'],
  kind20000Channels: ['bitchat', 'penpalclub', 'minchat', '9q', '6g', 'c2'],
  favoriteChannels: [],
  defaultChannel: 'minchat',
  powDifficulty: 8,
  encryptionKey: 'minchat-demo-key-0001',
  imagesEnabled: false
};

export default function App() {
  const [sk, setSk] = useState(() => {
    try {
      const saved = localStorage.getItem('minchat-sk');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Uint8Array(parsed);
      }
    } catch (error) {
      console.error('Failed to load secret key from localStorage:', error);
      localStorage.removeItem('minchat-sk');
    }
    return null;
  });
  const [pk, setPk] = useState(() => {
    try {
      const saved = localStorage.getItem('minchat-pk');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load public key from localStorage:', error);
      localStorage.removeItem('minchat-pk');
      return null;
    }
  });
  const [connected, setConnected] = useState(false);
  const [handle, setHandle] = useState(() => {
    const saved = localStorage.getItem('minchat-handle');
    return saved ? JSON.parse(saved) : 'anon';
  });
  const [channel, setChannel] = useState(() => {
    const saved = localStorage.getItem('minchat-channel');
    return saved ? JSON.parse(saved) : config.defaultChannel;
  });
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [mining, setMining] = useState(false);
  const poolRef = useRef(null);
  const subRef = useRef(null);
  const inputRef = useRef(null);
  const [e2eEnabled, setE2eEnabled] = useState(() => {
    const saved = localStorage.getItem('minchat-e2e-enabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [encryptionKey, setEncryptionKey] = useState(() => {
    const saved = localStorage.getItem('minchat-encryption-key');
    return saved ? JSON.parse(saved) : config.encryptionKey;
  });
  const [geolocation, setGeolocation] = useState(() => {
    const saved = localStorage.getItem('minchat-geolocation');
    return saved ? JSON.parse(saved) : null;
  });
  const [imagesEnabled, setImagesEnabled] = useState(() => {
    const saved = localStorage.getItem('minchat-images-enabled');
    return saved ? JSON.parse(saved) : config.imagesEnabled;
  });

  useEffect(() => {
    localStorage.setItem('minchat-images-enabled', JSON.stringify(imagesEnabled));
  }, [imagesEnabled]);

  useEffect(() => {
    localStorage.setItem('minchat-e2e-enabled', JSON.stringify(e2eEnabled));
  }, [e2eEnabled]);

  useEffect(() => {
    localStorage.setItem('minchat-encryption-key', JSON.stringify(encryptionKey));
  }, [encryptionKey]);

  useEffect(() => {
    localStorage.setItem('minchat-handle', JSON.stringify(handle));
  }, [handle]);

  useEffect(() => {
    if (sk && sk instanceof Uint8Array) {
      try {
        localStorage.setItem('minchat-sk', JSON.stringify(Array.from(sk)));
      } catch (error) {
        console.error('Failed to save secret key to localStorage:', error);
      }
    }
  }, [sk]);

  useEffect(() => {
    if (pk) {
      try {
        localStorage.setItem('minchat-pk', JSON.stringify(pk));
      } catch (error) {
        console.error('Failed to save public key to localStorage:', error);
      }
    }
  }, [pk]);

  useEffect(() => {
    localStorage.setItem('minchat-channel', JSON.stringify(channel));
  }, [channel]);

  // when the channel changes, auto-switch protocol to the correct one
  useEffect(() => {
    console.log(`channel changed to: #${channel}`);
    const newProtocol = config.kind1Channels.includes(channel) ? 'nostr' : 'bitchat';
    
    // only update protocol if it's different from current
    if (newProtocol !== chatProtocol) {
      setChatProtocol(newProtocol);
    } else {
      // protocol is the same, just reconnect with new channel
      if (connected) {
        changeChannel();
      }
    }
  }, [channel]);

  const [chatProtocol, setChatProtocol] = useState(() => {
    const saved = localStorage.getItem('minchat-chat-protocol');
    return saved ? JSON.parse(saved) : 'bitchat';
  });
  useEffect(() => {
    localStorage.setItem('minchat-chat-protocol', JSON.stringify(chatProtocol));
  }, [chatProtocol]);
  const [initialChangeChannelDone, setInitialChangeChannelDone] = useState(false);

  // auto-change channel when protocol changes (but not on initial load)
  // this reloads the messages for the new protocol
  useEffect(() => {
    if (!initialChangeChannelDone) {
      setInitialChangeChannelDone(true);
      return;
    }
    // reconnect when protocol changes
    if (connected) {
      changeChannel();
    }
  }, [chatProtocol]);

  const generateKeys = () => {
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    setSk(secretKey);
    setPk(publicKey);
  };

  const clearKeys = () => {
    localStorage.removeItem('minchat-sk');
    localStorage.removeItem('minchat-pk');
    setSk(null);
    setPk(null);
  };

  // auto-connect when pk is set
  useEffect(() => {
    if (pk && !connected) {
      connect();
    }
    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, [pk]);

  // persist relays config changes
  // const [relays, setRelays] = useState(() => {
  //   const saved = localStorage.getItem('minchat-relays');
  //   return saved ? JSON.parse(saved) : config.relays;
  // });
  const [relays, setRelays] = useState(() => {
    try {
      const savedRev = localStorage.getItem('minchat-revision');
      const savedRelays = localStorage.getItem('minchat-relays');
      // if no version or version mismatch, reset relays to factory defaults
      if (!savedRev || savedRev !== config.revision) {
        try {
          localStorage.setItem('minchat-relays', JSON.stringify(config.relays));
          localStorage.setItem('minchat-revision', config.revision);
        } catch (error) {
          console.error('Failed to reset relays to factory defaults:', error);
        }
        return config.relays;
      }
      return savedRelays ? JSON.parse(savedRelays) : config.relays;
    } catch (error) {
      console.error('Failed to load relays from localStorage:', error);
      try { 
        localStorage.removeItem('minchat-relays'); 
      } catch (error) {
        // ignore
      }
      return config.relays;
    }
  });
  useEffect(() => {
    localStorage.setItem('minchat-relays', JSON.stringify(relays));
  }, [relays]);

  // connect to relays and subscribe to messages
  function connect() {
    if (!pk) {
      alert('Generate keys first');
      return;
    }

    // close existing connection before creating new one
    if (subRef.current) {
      subRef.current.close();
    }

    poolRef.current = new SimplePool(config.simplePool);
    
    setMessages([]);
    setConnected(true);

    const now = Math.floor(Date.now() / 1000);
    const filter = chatProtocol === 'nostr'
      ? {
        kinds: [1],
        '#t': [channel],
        // since: now - 16000,
        since: 0,
        limit: 100
      }
      : {
        kinds: [20000, 23333],
        '#g': [channel],
        // since: now - 16000, // last ~4.5 hours
        since: now - 18000, // last 5 hours
        // since: now - 604800, // last 7 days
        limit: 100
      };

    try {
      subRef.current = poolRef.current.subscribeMany(relays.main, filter, {
        onevent(event) {
          console.log('Event:', event);
          const date = new Date(event.created_at * 1000);
          setMessages(prev => {
            const newMessage = {
              id: event.id,
              pubkey: event.pubkey,
              content: event.content,
              tags: event.tags,
              time: date.toLocaleTimeString(),
              created_at: event.created_at
            };
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage].sort((m1, m2) => m2.created_at - m1.created_at);
          });
        }
      });
    } catch (error) {
      console.error('Subscription failed:', error);
    }
  };

  function changeChannel() {
    if (!poolRef.current || !subRef.current) {
      // if not connected yet, just connect
      if (pk) {
        connect();
      }
      return;
    }
    
    // close existing subscription
    subRef.current.close();
    subRef.current = null;
    
    // clear messages and reconnect
    setMessages([]);
    connect();
  }

  async function send() {
    if (!sk) {
      alert('Generate keys first');
      return;
    }
    if (!message) return;

    let messageContent = message;
    // if e2e is enabled, encrypt the message for all recent participants
    if (e2eEnabled && !config.kind1Channels.includes(channel)) {
      try {
        messageContent = await encrypt(message, encryptionKey);
      } catch (error) {
        console.error('Encryption failed:', error);
        alert('Encryption failed');
        return;
      }
    }

    // determine kind based on protocol
    const isNostrProtocol = chatProtocol === 'nostr';
    const eventKind = isNostrProtocol ? 1 : 20000;

    let tags = isNostrProtocol
      ? [['t', channel]]
      : [['g', channel]];

    // add 'n' tag if handle is set and not 'anon'
    if (handle && handle !== 'anon' && !isNostrProtocol) {
      tags.push(['n', handle]);
    }

    // add 'e' tag for e2e if enabled
    if (e2eEnabled && !isNostrProtocol) {
      tags.push(['encrypted', 'aes-gcm']);
    }

    let event = {
      kind: eventKind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: messageContent,
      pubkey: pk
    };

    setMining(true);
    await new Promise(r => setTimeout(r, 100)); // allow ui to update
    try {
      // console.log('mining PoW...');
      // event = event || {};
      event = nip13.minePow(event, config.powDifficulty);
    } catch (e) {
      console.log('PoW mining failed:', e);
    }
    setMining(false);

    const signed = finalizeEvent(event, sk);

    if (!poolRef.current) {
      poolRef.current = new SimplePool(config.simplePool);
    }

    try {
      await poolRef.current.publish(relays.main, signed);
    } catch (error) {
      console.error('Failed to publish event:', error);
    }

    setMessage('');
    // refocus the input to keep keyboard open on ios
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };


  // LANDING PAGE
  if (!pk) {
    return (
      <LanderTab 
        generateKeys={generateKeys} 
      />
    );
  }


  // EXPLORE TAB
  const [exploreTabOpen, setexploreTabOpen] = useState(() => {
    const saved = localStorage.getItem('minchat-explore-tab-open');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => { localStorage.setItem('minchat-explore-tab-open', JSON.stringify(exploreTabOpen)); }, [exploreTabOpen]);
  // const [longformPosts, setLongformPosts] = useState([]);
  const [longformPosts, setLongformPosts] = useState(() => {
    const saved = localStorage.getItem('minchat-longform-posts');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('minchat-longform-posts', JSON.stringify(longformPosts)); }, [longformPosts]);
  const [lastFetchedDatestamp, setLastFetchedDatestamp] = useState(() => {
    const saved = localStorage.getItem('minchat-longform-last-fetched-datestamp');
    return saved ? JSON.parse(saved) : null;
  });
  useEffect(() => { localStorage.setItem('minchat-longform-last-fetched-datestamp', JSON.stringify(lastFetchedDatestamp)); }, [lastFetchedDatestamp]);
  const [loadingLongform, setLoadingLongform] = useState(false);
  const [longformTag, setLongformTag] = useState(() => {
    const saved = localStorage.getItem('minchat-longform-tag');
    return saved ? JSON.parse(saved) : 'nostr';
  });
  useEffect(() => { localStorage.setItem('minchat-longform-tag', JSON.stringify(longformTag)); }, [longformTag]);
  if (exploreTabOpen) {
    return (
      <ExploreTab
        config={config}
        relays={relays}
        poolRef={poolRef}
        exploreTabOpen={exploreTabOpen}
        setexploreTabOpen={setexploreTabOpen}
        longformPosts={longformPosts}
        setLongformPosts={setLongformPosts}
        loadingLongform={loadingLongform}
        setLoadingLongform={setLoadingLongform}
        lastFetchedDatestamp={lastFetchedDatestamp}
        setLastFetchedDatestamp={setLastFetchedDatestamp}
        setLongformTag={setLongformTag}
        longformTag={longformTag}
      />
    );
  }


  // MARKET TAB
  const [marketTabOpen, setMarketTabOpen] = useState(() => {
    const saved = localStorage.getItem('minchat-market-tab-open');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => { localStorage.setItem('minchat-market-tab-open', JSON.stringify(marketTabOpen)); }, [marketTabOpen]);
  
  const [marketPosts, setMarketPosts] = useState(() => {
    const saved = localStorage.getItem('minchat-market-posts');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('minchat-market-posts', JSON.stringify(marketPosts)); }, [marketPosts]);
  
  const [lastFetchedMarketDatestamp, setLastFetchedMarketDatestamp] = useState(() => {
    const saved = localStorage.getItem('minchat-market-last-fetched-datestamp');
    return saved ? JSON.parse(saved) : null;
  });
  useEffect(() => { localStorage.setItem('minchat-market-last-fetched-datestamp', JSON.stringify(lastFetchedMarketDatestamp)); }, [lastFetchedMarketDatestamp]);
  
  const [loadingMarket, setLoadingMarket] = useState(false);
  
  const [marketTag, setMarketTag] = useState(() => {
    const saved = localStorage.getItem('minchat-market-tag');
    return saved ? JSON.parse(saved) : '';
  });
  useEffect(() => { localStorage.setItem('minchat-market-tag', JSON.stringify(marketTag)); }, [marketTag]);
  
  if (marketTabOpen) {
    return (
      <MarketTab
        config={config}
        relays={relays}
        poolRef={poolRef}
        marketTabOpen={marketTabOpen}
        setMarketTabOpen={setMarketTabOpen}
        marketPosts={marketPosts}
        setMarketPosts={setMarketPosts}
        loadingMarket={loadingMarket}
        setLoadingMarket={setLoadingMarket}
        lastFetchedMarketDatestamp={lastFetchedMarketDatestamp}
        setLastFetchedMarketDatestamp={setLastFetchedMarketDatestamp}
        marketTag={marketTag}
        setMarketTag={setMarketTag}
      />
    );
  }


  // SETTINGS TAB
  const [settingsOpen, setSettingsOpen] = useState(() => {
    const saved = localStorage.getItem('minchat-settings-open');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => { localStorage.setItem('minchat-settings-open', JSON.stringify(settingsOpen)); }, [settingsOpen]);
  if (settingsOpen) {
    return (
      <SettingsTab 
        config={config}
        relays={relays}
        setRelays={setRelays}
        sk={sk}
        pk={pk}
        setSk={setSk}
        setSettingsOpen={setSettingsOpen}
        channel={channel}
        setChannel={setChannel}
        changeChannel={changeChannel}
        handle={handle}
        setHandle={setHandle}
        e2eEnabled={e2eEnabled}
        encryptionKey={encryptionKey}
        setEncryptionKey={setEncryptionKey}
        clearKeys={clearKeys}
        imagesEnabled={imagesEnabled}
        setImagesEnabled={setImagesEnabled}
        poolRef={poolRef}
        geolocation={geolocation}
        setGeolocation={setGeolocation}
        chatProtocol={chatProtocol}
      />
    );
  }


  // DM TAB
  const [dmTabOpen, setDmTabOpen] = useState(() => {
    const saved = localStorage.getItem('minchat-dm-tab-open');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => { localStorage.setItem('minchat-dm-tab-open', JSON.stringify(dmTabOpen)); }, [dmTabOpen]);
  if (dmTabOpen) {
    return (
      <DmTab
        config={config}
        relays={relays}
        poolRef={poolRef}
        sk={sk}
        pk={pk}
        handle={handle}
        setHandle={setHandle}
        encryptionKey={encryptionKey}
        e2eEnabled={e2eEnabled}
        setDmTabOpen={setDmTabOpen}
      />
    );
  }

  async function deleteEvent(eventId) {
    if (!sk) {
      alert('Cannot delete: No secret key');
      return;
    }

    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    // create a kind 5 deletion event (NIP-09)
    let event = {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', eventId]],
      content: 'deleted',
      pubkey: pk
    };

    setMining(true);
    await new Promise(r => setTimeout(r, 100)); // wait a tick to allow ui to update
    try {
      event = nip13.minePow(event, config.powDifficulty);
    } catch (e) {
      console.log('PoW mining failed:', e);
    }
    setMining(false);

    const signed = finalizeEvent(event, sk);

    if (!poolRef.current) {
      poolRef.current = new SimplePool(config.simplePool);
    }

    await poolRef.current.publish(relays.main, signed);
    
    // remove the message from local state
    setMessages(prev => prev.filter(msg => msg.id !== eventId));
  }


  function getUserColor(pubkey) {
    // [djb2 sorta](http://www.cse.yorku.ca/~oz/hash.html)
    let hash = 0;
    for (let i = 0; i < pubkey.length; i++) {
      hash = pubkey.charCodeAt(i) + (hash << 5) - hash;
      // hash = pubkey.charCodeAt(i) + (hash * 31);
    }
    //const hue = Math.abs(hash) % 360; // 0 - 359
    const hue = (Math.abs(hash) * 137.508) % 360;
    // hue saturation lightness
    // return `hsl(${hue}, 70%, 45%)`;
    return `hsl(${hue}, 45%, 65%)`; // nice pastel colors
  }


  // MAIN CHAT UI
  return (
    <ChatTab 
      config={config}
      sk={sk}
      pk={pk}
      handle={handle}
      setHandle={setHandle}
      channel={channel}
      setChannel={setChannel}
      chatProtocol={chatProtocol}
      setChatProtocol={setChatProtocol}
      message={message}
      setMessage={setMessage}
      messages={messages}
      setMessages={setMessages}
      mining={mining}
      e2eEnabled={e2eEnabled}
      setE2eEnabled={setE2eEnabled}
      encryptionKey={encryptionKey}
      inputRef={inputRef}
      send={send}
      getUserColor={getUserColor}
      deleteEvent={deleteEvent}
      setSettingsOpen={setSettingsOpen}
      setexploreTabOpen={setexploreTabOpen}
      setMarketTabOpen={setMarketTabOpen}
      setDmTabOpen={setDmTabOpen}
    />
  );
}

function AppLayout() {
  return (
    <>
      <App />
      <Analytics />
    </>
  );
}

render(<AppLayout />, document.getElementById('app'));