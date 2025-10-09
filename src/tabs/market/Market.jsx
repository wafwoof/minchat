import { X, RotateCcw, Telescope, ShoppingCart, Copy } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { hexToNpub } from '../../encryption.js';

export default function MarketTab({ 
  config, relays, poolRef, marketTabOpen, setMarketTabOpen, marketPosts, 
  setMarketPosts, loadingMarket, setLoadingMarket, lastFetchedMarketDatestamp, setLastFetchedMarketDatestamp,
  marketTag, setMarketTag
}) {
  async function fetchMarketPosts() {
    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }
    
    setLoadingMarket(true);
    setMarketPosts([]);
    
    const now = Math.floor(Date.now() / 1000);
    const filter = {
      kinds: [30402], // classified listings
      // since: now - 604800, // last 7 days
      since: now - 2592000, // last 30 days
      limit: 20
    };

    // only add tag filter if marketTag has a value
    if (marketTag && marketTag.trim()) {
      filter['#t'] = [marketTag];
    }

    const sub = poolRef.current.subscribeMany(relays.market, filter, {
      onevent(e) {
        // console.log('Market event:', e);
        const post = {
          id: e.id,
          pubkey: e.pubkey,
          content: e.content,
          tags: e.tags,
          created_at: e.created_at,
          title: e.tags.find(t => t[0] === 'title')?.[1] || 'Untitled',
          summary: e.tags.find(t => t[0] === 'summary')?.[1] || '',
          published_at: parseInt(e.tags.find(t => t[0] === 'published_at')?.[1]) || e.created_at,
          location: e.tags.find(t => t[0] === 'location')?.[1] || null,
          price: (() => {
            const p = e.tags.find(t => t[0] === 'price');
            if (!p) return null;
            const [ , amount, currency, frequency ] = p;
            let formatted = `${amount} ${currency?.toUpperCase() || ''}`;
            if (frequency) formatted += ` / ${frequency}`;
            return formatted;
          })(),
          images: e.tags.filter(t => t[0] === 'image').map(t => t[1]),
        };

        setMarketPosts(prev => {
          if (prev.some(p => p.id === post.id)) return prev;
          return [...prev, post].sort((a, b) => b.published_at - a.published_at);
        });
      }
    });

    // set last fetched datestamp
    setLastFetchedMarketDatestamp(new Date().toLocaleString());

    // close subscription after 5 seconds
    setTimeout(() => {
      sub.close();
      setLoadingMarket(false);
    }, 5000);
  };

  const [showImages, setShowImages] = useState({});

  function toggleImages(postId) {
    setShowImages(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  }

  return (
    <section class="appContainer">
      <div style="width: 100%; padding: 4px 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="left" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
            <ShoppingCart size={20} />
            <h3>Market Explorer (NIP-99)</h3>
          </div>
          <button 
            onClick={() => setMarketTabOpen(false)}
            style="background: none; border: none; color: white; cursor: pointer; padding: 4px;"
          >
            <X size={18} />
          </button>
        </div>
        
        <div style="margin: 8px 0; display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            value={marketTag}
            onInput={(e) => setMarketTag(e.target.value)}
            placeholder="Tag (e.g., nostr, bitcoin)"
            style="padding: 8px; border: 1px solid #444; background: #222; color: white; border-radius: 4px; flex: 1;"
          />
          <button 
            onClick={fetchMarketPosts}
            disabled={loadingMarket}
            style="padding: 8px 16px;"
          >
            {loadingMarket ? 'Loading...' : (<RotateCcw size={16} />)}
          </button>
        </div>

        <div style="margin: 8px 0;">
          {lastFetchedMarketDatestamp && !loadingMarket && (
            <p style="color: #aaa; font-size: 11px;">
              Last fetched ({marketPosts.length}) @ {lastFetchedMarketDatestamp}
            </p>
          )}
        </div>

        <div style="max-height: 88dvh; overflow-y: auto;">
          {marketPosts.length === 0 && !loadingMarket && (
            <p style="color: #aaa;">No listings found.</p>
          )}
          
          {marketPosts.map(post => (
            <div 
              key={post.id} 
              class="postContainer"
              style="border: 1px solid #444; margin: 8px 0; padding: 12px; border-radius: 8px; margin-bottom: 64px;"
            >
              <div style="margin-bottom: 8px;">
                <h4 style="margin: 0; color: #fff;">{post.title}</h4>
                <div style="font-size: 0.8em; color: #aaa; margin-top: 4px;">
                  by @anon#{post.pubkey.slice(-4)} • {new Date(post.published_at * 1000).toLocaleDateString()}
                </div>
              </div>
              
              {post.summary && (
                <div style="margin: 8px 0; color: #ccc; font-style: italic; overflow-wrap: break-word;">
                  {post.summary}
                </div>
              )}
              
              <div style="margin: 8px 0; font-size: 0.9em; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">
                {post.content}
              </div>

              <div style="margin-top: 8px; font-size: 0.9em; color: #bbb;">
                {post.price && <div><strong>Price:</strong> {post.price}</div>}
                {post.location && <div><strong>Location:</strong> {post.location}</div>}
                {post.tags.find(t => t[0] === 'condition') && (
                  <div><strong>Condition:</strong> {post.tags.find(t => t[0] === 'condition')[1]}</div>
                )}
                {post.tags.find(t => t[0] === 'quantity') && (
                  <div><strong>Quantity:</strong> {post.tags.find(t => t[0] === 'quantity')[1]}</div>
                )}
                {post.tags.find(t => t[0] === 'currency') && (
                  <div><strong>Currency:</strong> {post.tags.find(t => t[0] === 'currency')[1]}</div>
                )}
                {post.tags.find(t => t[0] === 'seller') && (
                  <div><strong>Seller:</strong> {post.tags.find(t => t[0] === 'seller')[1]}</div>
                )}
                {post.tags.find(t => t[0] === 'contact') && (
                  <div><strong>Contact:</strong> {post.tags.find(t => t[0] === 'contact')[1]}</div>
                )}
              </div>

              <div>
                <button
                  style={{
                    background: 'grey',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    marginTop: '40px'
                  }}
                  onClick={() => {
                    // navigator.clipboard.writeText(post.pubkey);
                    navigator.clipboard.writeText(hexToNpub(post.pubkey));
                    alert('Npub copied to clipboard.');
                  }}
                >
                  <Copy 
                    size={14}
                    style="margin-right: 8px;"
                  />
                  <span>
                    Copy Npub
                  </span>
                </button>
              </div>

              {post.images?.length > 0 && (
                <div style="margin-top: 8px;">
                  <button
                    style={{
                      background: '#222',
                      color: '#aaa',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.9em',
                      marginBottom: '8px'
                    }}
                    onClick={() => toggleImages(post.id)}
                  >
                    {showImages[post.id] ? 'Hide Images' : `Show Images (${post.images.length})`}
                  </button>
                  <p>
                    Image Urls:
                  </p>
                  <ul style="margin: 0; padding: 0px; list-style-type: none;">
                    {post.images.map((img, i) => (
                      <li key={i} style="font-size: 0.8em; color: #888; word-break: break-all;">
                        {img}
                      </li>
                    ))}
                  </ul>
                  {showImages[post.id] && (
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      {post.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          style="max-width: 120px; border-radius: 6px; border: 1px solid #333;"
                          alt=""
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style="font-size: 0.8em; color: #888; margin-top: 8px;">
                Tags: {post.tags.filter(t => t[0] === 't').map((t, idx) => (
                  <button
                    key={`${post.id}-${t[1]}-${idx}`}
                    style={{
                      background: 'transparent',
                      color: '#888',
                      border: 'none',
                      margin: '0',
                      marginRight: '8px',
                      padding: '0',
                      cursor: 'pointer',
                      fontSize: '0.9em'
                    }}
                    onClick={() => setMarketTag(t[1])}
                  >
                    #{t[1]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}