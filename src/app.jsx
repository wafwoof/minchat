import './app.css';
import { useState, useEffect, useRef } from 'preact/hooks';
import { render } from 'preact';
import { generateSecretKey, getPublicKey, finalizeEvent, SimplePool, nip13 } from 'nostr-tools';
import { 
  Lock, Settings, SendHorizontal,
  Pickaxe, Image, Telescope,
  ShoppingCart, Inbox, Copy,
  Trash2
} from 'lucide-preact';
import { encrypt, decrypt } from './encryption';
import LanderTab from './tabs/lander/Lander.jsx';
import SettingsTab from './tabs/settings/Settings.jsx';
import ExploreTab from './tabs/explore/Explore.jsx';
import MarketTab from './tabs/market/Market.jsx';
import DmTab from './tabs/dm/Dm.jsx';

const config = {
  version: '0.0.6',
  relays: {
    main: [
      'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      'wss://relay.damus.io', 
      'wss://relay.nostr.band', 
      'wss://nostr-relay.zimage.com', 
      'wss://offchain.pub',
      'wss://relay-testnet.k8s.layer3.news'
    ],
    wiki: [
      'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      'wss://nos.lol',
      'wss://relay.wikifreedia.xyz',
      'wss://relay.nostr.band',
    ],
    market: [
      'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://purplepag.es',
      'wss://relay.primal.net',
      'wss://relay.nostr.band'
    ],
    dm: [
      'wss://tr7b9d5l-8080.usw2.devtunnels.ms',
      'wss://relay.mostr.pub',
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
    ]
  },
  kind1Channels: ['nostr', 'tech', 'news', 'politics', 'netsequé', 'penpalclub'],
  kind20000Channels: ['minchat', '9q', '6g', 'c2', 'dr'],
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
    console.log('mining state changed:', mining);
  }, [mining]);

  useEffect(() => {
    localStorage.setItem('minchat-channel', JSON.stringify(channel));
  }, [channel]);

  // when the channel changes, auto-switch protocol to the correct one
  useEffect(() => {
    console.log(`channel changed to: #${channel}`);
    if (config.kind1Channels.includes(channel)) {
      setChatProtocol('nostr');
    } else {
      setChatProtocol('bitchat');
    }
    if (connected) {
      changeChannel();
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
    changeChannel();
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

  useEffect(() => {
    if (pk) {
      connect();
    }
    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, [pk]);

  // persist relays config changes
  const [relays, setRelays] = useState(() => {
    const saved = localStorage.getItem('minchat-relays');
    return saved ? JSON.parse(saved) : config.relays;
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

    poolRef.current = new SimplePool();
    
    setMessages([]);
    setConnected(true);

    const now = Math.floor(Date.now() / 1000);
    // const filter = config.kind1Channels.includes(channel)
    // const filter = (chatProtocol === 'nostr' || config.kind1Channels.includes(channel))
    const filter = chatProtocol === 'nostr'
      ? {
        kinds: [1],
        '#t': [channel],
        since: now - 16000,
        limit: 100
      }
      : {
        kinds: [20000, 23333],
        // '#t': [channel],
        '#g': [channel],
        since: now - 16000,
        limit: 100
      };

    // const relays = config.relays.main;
    subRef.current = poolRef.current.subscribeMany(relays.main, filter, {
      onevent(e) {
        const d = new Date(e.created_at * 1000);
        setMessages(prev => {
          const newMessage = {
            id: e.id,
            pubkey: e.pubkey,
            content: e.content,
            tags: e.tags,
            time: d.toLocaleTimeString(),
            created_at: e.created_at
          };
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage].sort((a, b) => b.created_at - a.created_at);
        });
      }
    });
  };
  // function disconnect() {
  //   if (subRef.current) subRef.current.close();
  //   setConnected(false);
  // };

  function changeChannel() {
    if (poolRef.current && subRef.current) {
      subRef.current.close();
      connect();
    } else {
      alert('Connect first');
    }
  };

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

    // Determine kind based on protocol
    // const isNostrProtocol = chatProtocol === 'nostr' || config.kind1Channels.includes(channel);
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
    await new Promise(r => setTimeout(r, 100)); // allow UI to update
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
      poolRef.current = new SimplePool();
    }

    // const relays = config.relays.main;
    await poolRef.current.publish(relays.main, signed);
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

  async function deletePost(eventId) {
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
    await new Promise(r => setTimeout(r, 100));
    try {
      event = nip13.minePow(event, config.powDifficulty);
    } catch (e) {
      console.log('PoW mining failed:', e);
    }
    setMining(false);

    const signed = finalizeEvent(event, sk);

    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }

    await poolRef.current.publish(relays.main, signed);
    
    // remove the message from local state
    setMessages(prev => prev.filter(msg => msg.id !== eventId));
  }


  // MAIN CHAT UI
  return (
    <section class="appContainer">
      <div class="keyContainer">
        {pk && (
          <div 
            class="left"
            onClick={() => {
              // const newHandle = prompt('Enter your handle (without @):', handle);
              // if (newHandle) setHandle(newHandle.replace(/@/g, '').slice(0, 20));
              if (chatProtocol === 'nostr') {
                setChatProtocol('bitchat');
              } else {
                setChatProtocol('nostr');
              }
            }}
          >
            <span>
              {chatProtocol}/
            </span>
            <span>
              @{handle}#{pk.slice(-4)}
            </span>
          </div>
        )}
        <div class="right">
          <div>
            <span
              style="margin-right: 4px; cursor: pointer;"
              onClick={() => {
                const newChannel = prompt('Enter channel name (without #):', channel);
                if (newChannel) {
                  setChannel(newChannel.replace(/#/g, '').slice(0, 20));
                }
              }}
            >
              #{channel}
            </span>
          </div>
          <div>
            {/* <span>e2ee </span> */}
            <Lock size={14} style="margin-right: 1px;" />
            <span>e2e </span>
            <input 
              type="checkbox" 
              id="e2e" 
              checked={e2eEnabled} 
              onChange={(e) => setE2eEnabled(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div class="messagesContainer">
        <div style={{ height: '8px', flexShrink: 0 }} />
        {messages.map(msg => {
          // check if message is encrypted
          const isEncrypted = msg.tags.some(tag => tag[0] === 'encrypted');
          let displayContent = msg.content;
          
          // if encrypted and we have e2e enabled, try to decrypt
          if (isEncrypted && e2eEnabled) {
            // Use a ref to store decrypted content to avoid re-rendering issues
            const [decryptedContent, setDecryptedContent] = useState('[Encrypted]');
            
            useEffect(() => {
              decrypt(msg.content, encryptionKey)
                .then(setDecryptedContent)
                .catch(() => setDecryptedContent('[Decryption failed]'));
            }, [msg.content]);
            
            displayContent = decryptedContent;

            // check for markdown style image ![alt](url)
            const mdImageRegex = /!\[.*?\]\((.*?)\)/;
            const mdImageMatch = displayContent.match(mdImageRegex);
            // const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|svg))/i;
            // const urlMatch = displayContent.match(urlRegex);
            //const allowedDomains = ['i.imgur.com', 'imgur.com', 'i.redd.it', 'media.tenor.com', 'media.giphy.com', 'pbs.twimg.com', 'cdn.discordapp.com'];
            if (mdImageMatch && mdImageMatch[1] && (mdImageMatch[1].startsWith('http://') || mdImageMatch[1].startsWith('https://'))) {
              const imageUrl = mdImageMatch[1];
              displayContent = (
                <div>
                  <img src={imageUrl} alt="Image" style="max-width: 200px; max-height: 200px;" />
                  <div>{displayContent.replace(mdImageRegex, '')}</div>
                </div>
              );
            }
          } 
          // else if (isEncrypted && !e2eEnabled) {
          //   displayContent = '[Encrypted message - enable e2e to decrypt]';
          // }
          return (
            <div key={msg.id} class="message">
              <div class="messageHeader">
                <strong
                  onClick={() => {
                    setMessage(message + `@${msg.tags.find(t => t[0] === 'n') ? msg.tags.find(t => t[0] === 'n')[1] : 'anon'}#${msg.pubkey.slice(-4)} `);
                  }}
                  style="cursor: pointer;"
                >
                  @{msg.tags.find(t => t[0] === 'n') ? msg.tags.find(t => t[0] === 'n')[1] : 'anon'}#{msg.pubkey.slice(-4)}
                </strong>
                <span>{msg.time}</span>
                {msg.tags.some(t => t[0] === 'nonce') && (<div style="display: flex;"><Pickaxe size={14} style="margin-left: 0;" /></div>)}
                {isEncrypted && (<div style="display: flex;"><Lock size={14} style="margin-left: 0;" /></div>)}
                {msg.pubkey !== pk && (
                  <Copy 
                    size={14} 
                    style="margin-left: 8px; cursor: pointer;"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.pubkey).then(() => {
                        alert('Public key copied to clipboard');
                      })
                    }}
                  />
                )}
                {msg.pubkey === pk && (
                  <Trash2 
                    size={14} 
                    style="margin-left: 8px; cursor: pointer;"
                    onClick={() => deletePost(msg.id)}
                  />
                )}
              </div>
              <div class="messageContent">
                {displayContent}
              </div>
            </div>
          );
        })}
      </div>

      <div class="buttonContainer">
        <div style="margin-right: 8px;">
          <button
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
        </div>
        <div style="margin-right: 8px;">
          <button
            onClick={() => {
              setDmTabOpen(true);
            }}
          >
            <Inbox size={16} />
          </button>
        </div>
        {/* <div style="margin-right: 8px;">
          <button
            onClick={() => {
              const imageUrl = prompt('Note: Only displays if e2ee is enabled.\n\nEnter image URL (must start with http:// or https://):');
              if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) 
                // && /\.(png|jpg|jpeg|gif|svg)$/i.test(imageUrl)
              ) {
                setMessage(message + ` ![Image](${imageUrl})`);
              }
            }}
          >
            <Image size={16} />
          </button>
        </div> */}
        <div style="margin-right: 8px;">
          <button
            onClick={() => setexploreTabOpen(true)}
          >
            <Telescope size={16} />
          </button>
        </div>
        <div style="margin-right: 8px;">
          <button
            onClick={() => setMarketTabOpen(true)}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
        <div>
          <form onSubmit={(e) => { e.preventDefault(); changeChannel(); }} style="margin-bottom: 0px;">
            <select 
              value={channel} 
              onChange={(e) => setChannel(e.target.value)}
              style="max-width: 100px;"
            >
              {!config.kind1Channels.includes(channel) && !config.kind20000Channels.includes(channel) && (
                <>
                  <option value={channel}>#{channel}</option>
                  <option disabled>──────────</option>
                </>
              )}
              <option disabled>Kind 1:</option>
              {config.kind1Channels.filter(ch => !config.favoriteChannels.includes(ch)).map(ch => (
                <option value={ch}>#{ch}</option>
              ))}
              <option disabled>Kind 20000/23333:</option>
              {config.kind20000Channels.filter(ch => !config.favoriteChannels.includes(ch)).map(ch => (
                <option value={ch}>#{ch}</option>
              ))}
            </select>
          </form>
        </div>
        {mining && (
          <div>
            {/* <span>Mining PoW...</span> */}
            <Pickaxe size={16} class="miningIcon" />
          </div>
        )}
      </div>
      <div class="userInputContainer">
        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <button
            type="button"
            onClick={() => {
              const imageUrl = prompt('Note: Only displays if e2ee is enabled.\n\nEnter image URL (must start with http:// or https://):');
              if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
                setMessage(message + ` ![Image](${imageUrl})`);
              }
            }}
            class="sendButton"
            style="width: 45px; border-left: 1px solid #ccc; border-right: none;"
          >
            <Image size={16} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={message}
            onInput={(e) => setMessage(e.target.value)}
            placeholder="Message"
            class=""
          />
          <button 
            type="button"
            onMouseDown={(e) => { e.preventDefault(); }}
            onTouchStart={(e) => { e.preventDefault(); send(); }}
            // onClick={() => { send(); }}
            class="sendButton"
          >
            <SendHorizontal size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}

render(<App />, document.getElementById('app'));