import './app.css';
import { useState, useEffect, useRef } from 'preact/hooks';
import { render } from 'preact';
import { generateSecretKey, getPublicKey, finalizeEvent, SimplePool, nip13 } from 'nostr-tools';
import { Lock, Settings, SendHorizontal, Earth, Map, Pickaxe, ArrowBigLeft, House, Key, User, Link } from 'lucide-preact';
import { encrypt, decrypt } from './encryption';
import geohash from 'ngeohash';

const config = {
  relays: [
    'wss://tr7b9d5l-8080.usw2.devtunnels.ms', 
    'wss://relay.damus.io', 
    'wss://relay.nostr.band', 
    'wss://nostr-relay.zimage.com', 
    'wss://offchain.pub'
  ],
  kind1Channels: ['nostr', 'grownostr', 'bitcoin','general', 'random'],
  kind20000Channels: ['minchat', 'crypto', '9q', 'c2', 'dr', 'test', 'tech'],
  favoriteChannels: ['minchat', '9q', 'c2', 'dr'],
  powDifficulty: 8,
  encryptionKey: 'minchat-demo-key-0001',
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

  const connect = () => {
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

  const disconnect = () => {
    if (subRef.current) subRef.current.close();
    setConnected(false);
  };

  const changeChannel = () => {
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

  // if no keys, prompt to generate
  if (!pk) {
    // generateKeys();
    return (
      <section class="appContainer">
        <div
          style="padding: 8px; max-width: 400px;"
        >
          <div class="logo">
            <img src="/favicon/favicon-96x96.png" alt="MinChat Logo" width="40" height="40" />
            <span>
              MinChat Demo
            </span>
          </div>
          <div style="height: 20px;" />
          <h3>Info</h3>
          <p>
            This is a minimal nostr client. It is also compatible with bitchat (20000/23333) and supports end-to-end encryption (E2EE) using AES-GCM.
          </p>
          <br />
          <p>
            You can change your handle by clicking on it (top-left). You can also change channels by clicking on the channel name (top-right). 
            I have included some saved channels for easy access.
          </p>
          <br />
          <p>
            Contact me if you have any questions or suggestions. Thanks.
          </p>
          <div 
            style="margin-top: 20px;"
          />
          <div class="keyContainer">
            <button 
              onClick={generateKeys}
              class=""
            >
              Generate Random Keypair
            </button>
          </div>
        </div>
      </section>
    );
  }

  const [settingsOpen, setSettingsOpen] = useState(false);
  if (settingsOpen) {
    return (
      <section class="appContainer" style="overflow-y: auto;">
        <div style="width: 100%; padding: 4px 16px;">
          <div style="display: flex; justify-content: flex-end;">
            <button
              onClick={() => setSettingsOpen(false)}
            >
              <ArrowBigLeft size={16} />
            </button>
          </div>
          <div style="height: 20px;" />
          <div>
            <h3>Settings</h3>
          </div>
        </div>
        <div class="channelContainer" style="padding: 4px 16px;">
          <p>
            Change Channel:
          </p>
          <form onSubmit={(e) => { e.preventDefault(); changeChannel(); }}>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {![...config.favoriteChannels, ...config.kind1Channels, ...config.kind20000Channels].includes(channel) && (
                <option value={channel}>#{channel}</option>
              )}
              {![...config.favoriteChannels, ...config.kind1Channels, ...config.kind20000Channels].includes(channel) && (
                <option disabled>──────────</option>
              )}
              {config.favoriteChannels.map(ch => (
                <option value={ch}>#{ch}</option>
              ))}
              <option disabled>──────────</option>
              {config.kind1Channels.filter(ch => !config.favoriteChannels.includes(ch)).map(ch => (
                <option value={ch}>#{ch}</option>
              ))}
              <option disabled>──────────</option>
              {config.kind20000Channels.filter(ch => !config.favoriteChannels.includes(ch)).map(ch => (
                <option value={ch}>#{ch}</option>
              ))}
            </select>
          </form>
          <p>
            Current Channel: #{channel}
          </p>
        </div>
        <div style="padding: 4px 16px;">
          <User size={28} />
          <p>
            Your Handle:
          </p>
          <input
            type="text"
            value={handle === 'anon' || !handle ? '' : handle}
            onInput={(e) => setHandle(e.target.value.replace(/@/g, '').slice(0, 20) || 'anon')}
            placeholder="Handle (without @)"
            class=""
            style="border: 1px solid #444; padding: 4px; width: 200px; background-color: #222; color: white;"
          />
          <div style="height: 12px;" />
          <Pickaxe size={28} />
          <p>
            PoW Difficulty: {config.powDifficulty}
          </p>
          <div style="height: 12px;" />
                    <Key size={28} />
          <p>
            End-to-End Encryption (E2EE): {e2eEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <div style="height: 12px;" />

          <p>
            Encryption Key:
          </p>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input
              type="text"
              value={encryptionKey}
              onInput={(e) => setEncryptionKey(e.target.value)}
              placeholder="Encryption key"
              class=""
              style="border: 1px solid #444; padding: 4px; width: 250px; background-color: #222; color: white;"
            />
            <button
              onClick={() => setEncryptionKey(config.encryptionKey)}
            >
              Reset
            </button>
          </div>
          <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
            (this key is only used for kind 20000/23333 channels/events, not kind 1)
          </p>
          <div style="height: 12px;" />
          <Key size={28} />
          <p>
            Public Key:
          </p>
          <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {pk}
          </p>
          <br />
          <p>
            Secret Key:
          </p>
          <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {sk.toString()}
          </p>
          <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
            (do not reveal this to anyone ever)
          </p>
        </div>
        <div
          style="padding: 4px 16px;"
        >
          <button
          onClick={() => {
            if (confirm('Are you sure you want to reset your keys? This will generate a new random identity.')) {
            clearKeys();
            window.location.reload();
            }
          }}
          >
          Reset Keys
          </button>
          <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
            (your keypair, you will lose access to your profile)
          </p>
        </div>
        <div
          style="padding: 4px 16px;"
        >
          <button
          onClick={() => {
            alert('Relays:\n' + Array.from(poolRef.current.relays.keys()).join('\n'));
          }}
          >
          List Relays
          </button>
          <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
            (all connected relays)
          </p>
          <div style="height: 12px;" />
          <Earth 
            size={28}
          />
          <p>
            Your Geohash: {geolocation ? geohash.encode(geolocation.coords.latitude, geolocation.coords.longitude) : 'Unset'}
          </p>
          <p>
            (note: your location is only stored in your browser and is never sent anywhere)
          </p>
        </div>
        <div style="padding: 4px 16px; font-size: 0.9em;">
          <div style="height: 12px;" />
          <Link size={28} />
          <br /><br />
          <a href="https://nostrdata.github.io/kinds/">
            https://nostrdata.github.io/kinds/
          </a>
          <br /><br />
          <a href="https://github.com/nostr-protocol/nips">
            https://github.com/nostr-protocol/nips
          </a>
          <br /><br />
          <a href="https://nietzschelabs.com">
            https://nietzschelabs.com
          </a>
          <br /><br />
          <p>
            v0.0.1
          </p>
        </div>
      </section>
    );
  }

  return (
    <section class="appContainer">
      <div class="keyContainer">
        {pk && (
          <div 
            class="left"
            onClick={() => {
              const newHandle = prompt('Enter your handle (without @):', handle);
              if (newHandle) {
                setHandle(newHandle.replace(/@/g, '').slice(0, 20));
              }
            }}
          >
            @{handle}#{pk.slice(-4)}
          </div>
        )}
        <div class="right">
          <div>
            <span
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
          } 
          // else if (isEncrypted && !e2eEnabled) {
          //   displayContent = '[Encrypted message - enable e2e to decrypt]';
          // }
          console.log(msg)
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
        <div>
          <button
            onClick={() => {
              navigator.geolocation.getCurrentPosition((position) => {
                setGeolocation(position);
                const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 2);
                // check if user wants to go to this geohash channel
                if (confirm(`This geohash is a ~300k² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                  setChannel(geohashCode);
                }
                setChannel(geohashCode);
              }, (error) => {
                console.error('Error getting location:', error);
                alert('Error getting location: ' + error.message);
              });
            }}
          >
            <Earth size={16} />
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              navigator.geolocation.getCurrentPosition((position) => {
                setGeolocation(position);
                const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 5);
                // check if user wants to go to this geohash channel
                if (confirm(`This geohash is a ~3² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                  setChannel(geohashCode);
                }
                setChannel(geohashCode);
              }, (error) => {
                console.error('Error getting location:', error);
                alert('Error getting location: ' + error.message);
              });
            }}
          >
            <Map size={16} />
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