import { 
  Lock, Settings, SendHorizontal,
  Pickaxe, Image, Telescope,
  ShoppingCart, Inbox, Copy,
  Trash2
} from 'lucide-preact';
import { encrypt, decrypt, hexToNpub } from '../../encryption.js';

export default function ChatTab({
  config,
  sk,
  pk,
  handle,
  setHandle,
  channel,
  setChannel,
  chatProtocol,
  setChatProtocol,
  message,
  setMessage,
  messages,
  setMessages,
  mining,
  e2eEnabled,
  setE2eEnabled,
  encryptionKey,
  inputRef,
  send,
  getUserColor,
  deleteEvent,
  setSettingsOpen,
  setexploreTabOpen,
  setDmTabOpen,
  setMarketTabOpen,
}) {
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
          
          // if encrypted and we have e2e enabled, show decrypted version
          if (isEncrypted && e2eEnabled) {
            displayContent = '[Encrypted]';
            
            // decrypt asynchronously and update ui when ready
            decrypt(msg.content, encryptionKey)
              .then(decrypted => {
                // check for markdown style image ![alt](url)
                const mdImageRegex = /!\[.*?\]\((.*?)\)/;
                const mdImageMatch = decrypted.match(mdImageRegex);
                
                if (mdImageMatch && mdImageMatch[1] && (mdImageMatch[1].startsWith('http://') || mdImageMatch[1].startsWith('https://'))) {
                  // store image info in the message object
                  msg.decryptedImage = mdImageMatch[1];
                  msg.decryptedText = decrypted.replace(mdImageRegex, '');
                } else {
                  msg.decryptedText = decrypted;
                }
                
                // trigger re-render
                setMessages([...messages]);
              })
              .catch(() => {
                msg.decryptedText = '[Decryption failed]';
                setMessages([...messages]);
              });
            
            // display cached decrypted content if available
            if (msg.decryptedImage) {
              displayContent = (
                <div>
                  <img src={msg.decryptedImage} alt="Image" style="max-width: 200px; max-height: 200px;" />
                  <div>{msg.decryptedText}</div>
                </div>
              );
            } else if (msg.decryptedText) {
              displayContent = msg.decryptedText;
            }
          }
          
          return (
            <div key={msg.id} class="message">
              <div class="messageHeader">
                <strong
                  onClick={() => {
                    setMessage(message + `@${msg.tags.find(t => t[0] === 'n') ? msg.tags.find(t => t[0] === 'n')[1] : 'anon'}#${msg.pubkey.slice(-4)} `);
                  }}
                  style={`cursor: pointer; color: ${getUserColor(msg.pubkey)};`}
                >
                  @{msg.tags.find(t => t[0] === 'n') ? msg.tags.find(t => t[0] === 'n')[1] : 'anon'}#{msg.pubkey.slice(-4)}
                </strong>
                <span>{msg.time}</span>
                {isEncrypted && (<div style="display: flex;"><Lock size={14} style="margin-left: 0;" /></div>)}
                {msg.tags.some(t => t[0] === 'nonce') && (<div style="display: flex;"><Pickaxe size={14} style="margin-left: 0;" /></div>)}
                {msg.pubkey !== pk && (
                  <Copy 
                    size={14} 
                    style="cursor: pointer;"
                    onClick={() => {
                      // navigator.clipboard.writeText(msg.pubkey).then(() => {
                      navigator.clipboard.writeText(hexToNpub(msg.pubkey)).then(() => {
                        alert('Npub copied to clipboard.');
                      })
                    }}
                  />
                )}
                {msg.pubkey === pk && (
                  <Trash2 
                    size={14} 
                    style="cursor: pointer;"
                    onClick={() => deleteEvent(msg.id)}
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
        <div>
          <button
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
        </div>
        <div>
          <button
            onClick={() => {
              setDmTabOpen(true);
            }}
          >
            <Inbox size={16} />
          </button>
        </div>
        <div>
          <button
            onClick={() => setexploreTabOpen(true)}
          >
            <Telescope size={16} />
          </button>
        </div>
        <div>
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
            <Pickaxe 
              size={16} 
              class="miningIcon" 
            />
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
            style="width: 44px; border-left: 1px solid #ccc; border-right: none;"
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