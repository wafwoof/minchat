import { 
  X, Earth, Map, User, Pickaxe, Key, Image, Link, Satellite, Hash, Copy
} from 'lucide-preact';
import geohash from 'ngeohash';
import { useRef, useState } from 'preact/hooks';

export default function SettingsTab({
  config, relays, setRelays, sk, pk, setSk, setSettingsOpen, channel, setChannel,
  changeChannel, handle, setHandle, e2eEnabled, encryptionKey,
  setEncryptionKey, clearKeys, imagesEnabled, setImagesEnabled,
  poolRef, geolocation, setGeolocation, 
}) {
  const channelDebounceRef = useRef(null);
  const [editingRelays, setEditingRelays] = useState(false);
  const [relayInput, setRelayInput] = useState('');
  const [selectedRelayCategory, setSelectedRelayCategory] = useState('main');
  const [showSecretKey, setShowSecretKey] = useState(false);

  const addRelay = () => {
    const relay = relayInput.trim();
    if (!relay) return;
    
    if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
      alert('Relay must start with wss:// or ws://');
      return;
    }
    
    if (relays[selectedRelayCategory].includes(relay)) {
      alert('Relay already exists in this category');
      return;
    }
    
    setRelays({
      ...relays,
      [selectedRelayCategory]: [...relays[selectedRelayCategory], relay]
    });
    setRelayInput('');
  };

  const removeRelay = (category, relay) => {
    if (relays[category].length === 1) {
      alert('You must have at least one relay in each category');
      return;
    }
    setRelays({
      ...relays,
      [category]: relays[category].filter(r => r !== relay)
    });
  };

  const resetRelays = () => {
    if (confirm('Reset to default relays?')) {
      setRelays(config.relays);
    }
  };

  return (
    <section class="appContainer" style="overflow-y: auto;">
      <div style="width: 100%; padding: 4px 16px;">
        <div
          class="settings-header"
          style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%; padding: 4px 0;"
        >
          <h3>Settings</h3>
          <button
            onClick={() => setSettingsOpen(false)}
            style="background: none; border: none; color: white; cursor: pointer; padding: 4px;"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div class="channelContainer" style="padding: 4px 16px; margin-bottom: 16px;">
        <Hash size={20} />
        <p>
          Change Channel:
        </p>
        <form onSubmit={(e) => { e.preventDefault(); changeChannel(); }} style="margin-bottom: 8px;">
          <select 
            value={channel} 
            onChange={(e) => setChannel(e.target.value)}
          >
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
        <p>
          Current Channel:
        </p>
        <input 
          type="text"
          value={channel}
          onInput={(e) => {
            const newChannel = e.target.value.replace(/#/g, '').slice(0, 32);
            if (channelDebounceRef.current) {
              clearTimeout(channelDebounceRef.current);
            }
            channelDebounceRef.current = setTimeout(() => {
              setChannel(newChannel);
            }, 1600);
          }}
          placeholder="Channel name (without #)"
          class=""
          style="border: 1px solid #444; padding: 4px; width: 200px; background-color: #222; color: white;"
        />
      </div>
      <div style="padding: 4px 16px;">
        <User size={20} />
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
        <div style="height: 24px;" />
        <Key size={20} />
        <p>
          End-to-End Encryption (E2EE): {e2eEnabled ? 'Enabled' : 'Disabled'}
        </p>
        <div style="height: 24px;" />

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
        <div style="height: 24px;" />
        <Key size={20} />
        <p>
          Public Key:
        </p>
        <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {pk}
        </p>
        <br />
        <button
          onClick={() => {
            navigator.clipboard.writeText(pk);
            alert('Public key copied to clipboard.');
          }}
        >
          <Copy size={16} style="margin-right: 8px;" />
          <span>
            Copy Public Key
          </span>
        </button>
        <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
          (you can share this with others to confirm your identity or receive DMs)
        </p>
        <br />
        <p>
          Secret Key:
        </p>
        {/* <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {sk.toString()}
        </p> */}
        <p
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            filter: showSecretKey ? 'none' : 'blur(2px)',
            userSelect: showSecretKey ? 'auto' : 'none'
          }}
        >
          {/* [{sk.toString()}] */}
          {showSecretKey ? `[${sk.toString()}]` : '•'.repeat(120)}
        </p>
        <br />
        <button
          onClick={() => setShowSecretKey(!showSecretKey)}
        >
          {showSecretKey ? 'Hide' : 'Show'} Secret Key
        </button>
        <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
          (do not reveal this to anyone ever)
        </p>
      </div>
      <div
        style="padding: 4px 16px; margin-bottom: 16px;"
      >
        <button
        onClick={() => {
          if (confirm('Are you sure you want to reset your keys? This will generate a new random identity.')) {
          clearKeys();
          window.location.reload();
          }
        }}
        >
        Reset Keypair
        </button>
        <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
          (you will lose access to your profile)
        </p>
      </div>
      <div
        style="padding: 4px 16px;"
      >
        <Earth size={20} />
        <p>
          Your Geohash: {geolocation ? geohash.encode(geolocation.coords.latitude, geolocation.coords.longitude) : 'Unset'}
        </p>
        <p>
          (note: your location is only stored in your browser and is never sent anywhere)
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px 16px; margin-bottom: 16px;">
        <p>
          Geohash teleports:
        </p>
        <button
          style="display: flex; flex-direction: row; justify-content: flex-start; align-items: center;"
          onClick={() => {
            navigator.geolocation.getCurrentPosition((position) => {
              setGeolocation(position);
              const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 2);
              if (confirm(`This geohash is a ~300k² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                setChannel(geohashCode);
              }
            }, (error) => {
              console.error('Error getting location:', error);
              alert('Error getting location: ' + error.message);
            });
          }}
        >
          <Earth size={16} style="margin-right: 8px;" />
          <span>
            ~300k² mile area
          </span>
        </button>
        <button
          style="display: flex; flex-direction: row; justify-content: flex-start; align-items: center;"
          onClick={() => {
            navigator.geolocation.getCurrentPosition((position) => {
              setGeolocation(position);
              const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 5);
              if (confirm(`This geohash is a ~3² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                setChannel(geohashCode);
              }
            }, (error) => {
              console.error('Error getting location:', error);
              alert('Error getting location: ' + error.message);
            });
          }}
        >
          <Map size={16} style="margin-right: 8px;" />
          <span>
            ~3² mile area
          </span>
        </button>
      </div>
      <div style="padding: 4px 16px;">
        <Satellite size={20} />
        <p>
          Relays:
        </p>
        <div style="height: 24px;" />
        {editingRelays ? (
          <div>
            <div style="margin-bottom: 12px;">
              <label style="display: block; margin-bottom: 8px;">
                Category: 
                <select
                  value={selectedRelayCategory}
                  onChange={(e) => setSelectedRelayCategory(e.target.value)}
                  style="margin-left: 8px; padding: 4px; background: #222; color: white; border: 1px solid #444;"
                >
                  <option value="main">Main (Chat, Posts & Longform)</option>
                  <option value="wiki">Wiki</option>
                  <option value="market">Market</option>
                  <option value="dm">DM</option>
                </select>
              </label>
            </div>

            <div style="margin-bottom: 16px; padding: 8px; background: #1a1a1a; border-radius: 4px;">
              <p style="font-weight: bold; margin-bottom: 8px; font-size: 0.9em;">
                {selectedRelayCategory.toUpperCase()} ({relays[selectedRelayCategory].length})
              </p>
              {relays[selectedRelayCategory].map(relay => (
                <div key={relay} style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="flex: 1; font-size: 0.9em; word-break: break-all;">{relay}</span>
                  <button
                    onClick={() => removeRelay(selectedRelayCategory, relay)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <input
                type="text"
                value={relayInput}
                onInput={(e) => setRelayInput(e.target.value)}
                placeholder="wss://relay.example.com"
                style="flex: 1; border: 1px solid #444; padding: 8px; background-color: #222; color: white;"
              />
              <button onClick={addRelay} style="padding: 8px 16px;">
                Add to {selectedRelayCategory}
              </button>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button onClick={resetRelays}>
                Reset to Defaults
              </button>
              <button onClick={() => setEditingRelays(false)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            {Object.entries(relays).map(([category, categoryRelays]) => (
              <div key={category} style="margin-bottom: 16px;">
                <p style="font-weight: bold; margin-bottom: 4px; font-size: 0.9em; text-transform: uppercase;">
                  {category} ({categoryRelays.length})
                </p>
                <ul style="overflow-y: auto; padding-left: 20px; margin: 4px 0;">
                  {categoryRelays.map(r => (
                    <li key={r} style="font-size: 0.8em; word-break: break-all; margin-bottom: 4px;">{r}</li>
                  ))}
                </ul>
              </div>
            ))}
            <button onClick={() => setEditingRelays(true)}>
              Edit Relays
            </button>
          </div>
        )}
      </div>
      <div style="padding: 4px 16px; margin-bottom: 16px;">
        <p>
          Connected Relays:
        </p>
        <ul style="overflow-y: auto; padding-left: 20px; margin: 0;">
          {Array.from(poolRef.current ? poolRef.current.relays.keys() : []).map(r => (
            <li key={r} style="font-size: 0.8em; word-break: break-all;">{r}</li>
          ))}
        </ul>
      </div>
      <div style="padding: 4px 16px;">
        <Pickaxe size={20} />
        <p>
          PoW Difficulty: {config.powDifficulty}
        </p>
        <div style="height: 24px;" />
        <Image size={20} />
        <p>
          Images: {imagesEnabled ? 'Enabled' : 'Disabled'}
        </p>
        <label style="display: flex; align-items: center; gap: 8px;">
          <span>Enable Images</span>
          <input type="checkbox" id="images" checked={imagesEnabled} onChange={(e) => setImagesEnabled(e.target.checked)} />
        </label>
        <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
          (only images from markdown syntax will be displayed, e.g. ![alt](url) and only if e2ee is enabled)
        </p>
      </div>
      <div style="padding: 4px 16px; font-size: 0.9em;">
        <div style="height: 24px;" />
        <Link size={20} />
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
          MinChat v{config.version} -  minimal nostr hybrid client thing by Nietzsche Labs
        </p>
      </div>
    </section>
  );
}