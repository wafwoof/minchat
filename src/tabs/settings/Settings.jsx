import { 
  X, Earth, Map, User, Pickaxe, Key, Image, Link
} from 'lucide-preact';
import geohash from 'ngeohash';
import { useRef } from 'preact/hooks';

export default function SettingsTab({
  config, sk, pk, setSk, setSettingsOpen, channel, setChannel,
  changeChannel, handle, setHandle, e2eEnabled, encryptionKey,
  setEncryptionKey, clearKeys, imagesEnabled, setImagesEnabled,
  poolRef, geolocation, setGeolocation
}) {
  const channelDebounceRef = useRef(null);

  return (
    <section class="appContainer" style="overflow-y: auto;">
      <div style="width: 100%; padding: 4px 16px;">
        <div style="display: flex; justify-content: flex-end;">
          <button
            onClick={() => setSettingsOpen(false)}
            style="background: none; border: none; color: white; cursor: pointer; padding: 4px;"
          >
            <X size={16} />
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
          <select 
            value={channel} 
            onChange={(e) => setChannel(e.target.value)}
          >
            {/* {![...config.favoriteChannels, ...config.kind1Channels, ...config.kind20000Channels].includes(channel) && (
              <option value={channel}>#{channel}</option>
            )}
            {![...config.favoriteChannels, ...config.kind1Channels, ...config.kind20000Channels].includes(channel) && (
              <option disabled>──────────</option>
            )} */}
            {/* {config.favoriteChannels.map(ch => (
              <option value={ch}>#{ch}</option>
            ))} */}
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
          Current Channel: #{channel}
        </p>
        <input 
          type="text"
          value={channel}
          onInput={(e) => {
            const newChannel = e.target.value.replace(/#/g, '').slice(0, 32);
            // clear existing timeout
            if (channelDebounceRef.current) {
              clearTimeout(channelDebounceRef.current);
            }
            // set new timeout for 2 seconds
            channelDebounceRef.current = setTimeout(() => {
              setChannel(newChannel);
            }, 1600);
          }}
          placeholder="Channel name (without #)"
          class=""
          style="border: 1px solid #444; padding: 4px; width: 200px; background-color: #222; color: white;"
        />
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px 16px;">
        <p>
          Geohash teleports:
        </p>
        <button
          style="display: flex; flex-direction: row;"
          onClick={() => {
            navigator.geolocation.getCurrentPosition((position) => {
              setGeolocation(position);
              const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 2);
              // check if user wants to go to this geohash channel
              if (confirm(`This geohash is a ~300k² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                setChannel(geohashCode);
              }
              // setChannel(geohashCode);
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
          style="display: flex; flex-direction: row;"
          onClick={() => {
            navigator.geolocation.getCurrentPosition((position) => {
              setGeolocation(position);
              const geohashCode = geohash.encode(position.coords.latitude, position.coords.longitude).slice(0, 5);
              // check if user wants to go to this geohash channel
              if (confirm(`This geohash is a ~3² mile area (with you inside).\nWould you like to go to this channel?\n\n#${geohashCode}`)) {
                setChannel(geohashCode);
              }
              // setChannel(geohashCode);
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
      <div style="padding: 4px 16px;">
        <p>
          Connected Relays:
        </p>
        <ul style="max-height: 100px; overflow-y: auto; padding-left: 20px; margin: 0;">
          {Array.from(poolRef.current ? poolRef.current.relays.keys() : []).map(r => (
            <li key={r} style="font-size: 0.8em; word-break: break-all;">{r}</li>
          ))}
        </ul>
        {/* <p style="font-size: 0.9em; color: #aaa; margin-top: 8px;">
          (all connected relays)
        </p> */}
        {/* <div style="height: 24px;" /> */}
      </div>
      <div style="padding: 4px 16px;">
        <Image size={28} />
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
          MinChat v{config.version} -  minimal nostr hybrid client thing by Nietzsche Labs
        </p>
      </div>
    </section>
  );
}