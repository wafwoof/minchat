import './app.css';
import { useState, useEffect, useRef } from 'preact/hooks';
import { render } from 'preact';
import { generateSecretKey, getPublicKey, finalizeEvent, SimplePool, nip13 } from 'nostr-tools';
import { 
  Lock, Settings, SendHorizontal, Earth, Map, 
  Pickaxe, ArrowBigLeft, House, Key, User, 
  Link, Signal, SignalZero, Image, Telescope
} from 'lucide-preact';
import { encrypt, decrypt } from './encryption';
// import geohash from 'ngeohash';
import LanderTab from './tabs/lander/Lander.jsx';
import ExploreTab from './tabs/explore/Explore.jsx';
import SettingsTab from './tabs/settings/Settings.jsx';

const config = {
  version: '0.0.2',
  relays: [
    'wss://tr7b9d5l-8080.usw2.devtunnels.ms', 
    'wss://relay.damus.io', 
    'wss://relay.nostr.band', 
    'wss://nostr-relay.zimage.com', 
    'wss://offchain.pub',
    'wss://relay-testnet.k8s.layer3.news'
  ],
  kind1Channels: ['nostr', 'grownostr', 'bitcoin','general', 'random'],
  kind20000Channels: ['minchat', 'crypto', '9q', 'c2', 'dr', 'test', 'tech'],
  favoriteChannels: ['minchat', '9q', 'c2', 'dr'],
  powDifficulty: 8,
  encryptionKey: 'minchat-demo-key-0001',
  imagesEnabled: true
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
  // const [channel, setChannel] = useState('minchat');
  const [channel, setChannel] = useState(() => {
    const saved = localStorage.getItem('minchat-channel');
    return saved ? JSON.parse(saved) : 'minchat';
  });
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [mining, setMining] = useState(false);
  const poolRef = useRef(null);
  const subRef = useRef(null);
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

  // useEffect(() => {
  //   console.log(messages);
  // }, [messages]);

  useEffect(() => {
    console.log('mining state changed:', mining);
  }, [mining]);

  useEffect(() => {
    localStorage.setItem('minchat-channel', JSON.stringify(channel));
  }, [channel]);

  useEffect(() => {
    console.log('channel changed to:', channel);
    if (connected) {
      changeChannel();
    }
  }, [channel]);

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

  function connect() {
    if (!pk) {
      alert('Generate keys first');
      return;
    }

    poolRef.current = new SimplePool();
    
    setMessages([]);
    setConnected(true);

    const now = Math.floor(Date.now() / 1000);
    const filter = config.kind1Channels.includes(channel)
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

    subRef.current = poolRef.current.subscribeMany(config.relays, filter, {
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
          // check if message already exists to avoid duplicates
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          // add new message and sort by created_at (newest first)
          return [...prev, newMessage].sort((a, b) => b.created_at - a.created_at);
        });
      }
    });

  };

  function disconnect() {
    if (subRef.current) subRef.current.close();
    setConnected(false);
  };

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

    let tags = config.kind1Channels.includes(channel)
      ? [['t', channel]]
      : [['g', channel]];

    // add 'n' tag if handle is set and not 'anon'
    if (handle && handle !== 'anon' && !config.kind1Channels.includes(channel)) {
      tags.push(['n', handle]);
    }

    // add 'e' tag for e2e if enabled
    if (e2eEnabled && !config.kind1Channels.includes(channel)) {
      tags.push(['encrypted', 'aes-gcm']);
    }

    let event = config.kind1Channels.includes(channel) ? {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: messageContent,
      pubkey: pk
    } : {
      kind: 20000,
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

    await poolRef.current.publish(
      config.relays,
      signed
    );
    setMessage('');
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
      />
    );
  }


  // MAIN CHAT UI
  return (
    <section class="appContainer">
      <div class="keyContainer">
        {pk && (
          <div 
            class="left"
            onClick={() => {
              const newHandle = prompt('Enter your handle (without @):', handle);
              if (newHandle) setHandle(newHandle.replace(/@/g, '').slice(0, 20));
            }}
          >
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
            {/* {connected ? (
              <Signal size={14} style="color: white;" title="Connected" />
            ) : (
              <SignalZero size={14} style="color: red;" title="Disconnected" />
            )} */}
          </div>
          <div>
            <span>e2ee </span>
            <input type="checkbox" id="e2e" checked={e2eEnabled} onChange={(e) => setE2eEnabled(e.target.checked)} />
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
            const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|svg))/i;
            const urlMatch = displayContent.match(urlRegex);
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
                <strong>@{msg.tags.find(t => t[0] === 'n') ? msg.tags.find(t => t[0] === 'n')[1] : 'anon'}#{msg.pubkey.slice(-4)}</strong>
                <span>{msg.time}</span>
                {msg.tags.some(t => t[0] === 'nonce') && (<div style="display: flex;"><Pickaxe size={14} style="margin-left: 0;" /></div>)}
                {isEncrypted && (<div style="display: flex;"><Lock size={14} style="margin-left: 0;" /></div>)}
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
        </div>
        <div style="margin-right: 8px;">
          <button
            onClick={() => setexploreTabOpen(true)}
          >
            <Telescope size={16} />
          </button>
        </div>
        <div>
            <button
              onClick={() => setChannel('minchat')}
            >
              <House size={16} />
            </button>
        </div>
        <div>
            <button
              onClick={() => setChannel('9q')}
            >
              #9q
            </button>
        </div>
        <div>
            <button
              onClick={() => setChannel('nostr')}
            >
              #nostr
            </button>
        </div>
        {mining && (
          <div>
            <span>Mining PoW...</span>
          </div>
        )}
      </div>
      <div class="userInputContainer">
        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input
            type="text"
            value={message}
            onInput={(e) => setMessage(e.target.value)}
            // onKeyPress={(e) => e.key === 'Enter' && send()}
            placeholder="Message"
            class=""
          />
          <button 
            type="submit"
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