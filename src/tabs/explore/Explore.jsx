import { ArrowBigLeft, RotateCcw, Telescope, SlidersHorizontal } from 'lucide-preact';
import { useState, useEffect } from 'preact/hooks';

export default function ExploreTab({ 
  config, poolRef, exploreTabOpen, setexploreTabOpen, longformPosts, 
  setLongformPosts, loadingLongform, setLoadingLongform, lastFetchedDatestamp, setLastFetchedDatestamp,
  longformTag, setLongformTag
}) {
  // Add state for selected kind
  // const [selectedKind, setSelectedKind] = useState('30023'); // default to longform, not wiki
  const [selectedKind, setSelectedKind] = useState(() => {
    const saved = localStorage.getItem('exploreSelectedKind');
    return saved === null ? '30023' : saved; // default to longform if nothing saved
  });
  useEffect(() => {
    localStorage.setItem('exploreSelectedKind', selectedKind);
  }, [selectedKind]);

  async function fetchLongformPosts() {
    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }
    
    setLoadingLongform(true);
    setLongformPosts([]);
    
    const now = Math.floor(Date.now() / 1000);
    const filter = {
      kinds: selectedKind ? [parseInt(selectedKind)] : [30023, 30818],
      since: now - 604800, // last 7 days
      limit: 15
    };

    // only add tag filter if longformTag has a value
    if (longformTag && longformTag.trim()) {
      filter['#t'] = [longformTag];
    }

    const relays = selectedKind === '30818'
      ? [
          'wss://nos.lol',
          'wss://relay.wikifreedia.xyz',
          'wss://relay.nostr.band',
        ]
      : config.relays;
    const sub = poolRef.current.subscribeMany(relays, filter, {
    // const sub = poolRef.current.subscribeMany(config.relays, filter, {
      onevent(e) {
        console.log('Explore event:', e);
        const post = {
          id: e.id,
          pubkey: e.pubkey,
          content: e.content,
          tags: e.tags,
          created_at: e.created_at,
          kind: e.kind,
          title: e.tags.find(t => t[0] === 'title')?.[1] || 'Untitled',
          summary: e.tags.find(t => t[0] === 'summary')?.[1] || '',
          published_at: e.tags.find(t => t[0] === 'published_at')?.[1] || e.created_at,
          wikiId: e.kind === 30818 ? e.tags.find(t => t[0] === 'd')?.[1] : null,
          altText: e.tags.find(t => t[0] === 'alt')?.[1] || ''
        };
        
        setLongformPosts(prev => {
          if (prev.some(p => p.id === post.id)) return prev;
          return [...prev, post].sort((a, b) => b.published_at - a.published_at);
        });
      }
    });

    // set last fetched datestamp
    setLastFetchedDatestamp(new Date().toLocaleString());

    // close subscription after 5 seconds
    setTimeout(() => {
      sub.close();
      setLoadingLongform(false);
    }, 5000);
  };

  return (
    <section class="appContainer">
      <div style="width: 100%; padding: 4px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="left" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
            <Telescope size={20} />
            <h3>
              {/* Longform Explorer */}
              {selectedKind === '30023' ? 'Longform Explorer' : selectedKind === '30818' ? 'Wiki Explorer' : 'Explorer'}
            </h3>
          </div>
          <button onClick={() => setexploreTabOpen(false)}>
            <ArrowBigLeft size={16} />
          </button>
        </div>
        
        <div style="margin: 8px 0; display: flex; gap: 8px; align-items: center;">
          <div
            style="position: relative; flex-shrink: 0;"
          >
            <select 
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
                style="width: 40px; padding: 8px; border: 1px solid #444; background: #222; color: transparent; border-radius: 4px; appearance: none; cursor: pointer;"
              >
                <option value="">Any Kind</option>
                <option value="30023">Longform</option>
                <option value="30818">Wiki</option>
              </select>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;">
                <SlidersHorizontal size={16} color="#fff" />
              </div>
            </div>
          <input
            type="text"
            value={longformTag}
            onInput={(e) => setLongformTag(e.target.value)}
            placeholder="Tag (e.g., nostr, bitcoin)"
            style="padding: 8px; border: 1px solid #444; background: #222; color: white; border-radius: 4px; flex: 1;"
          />
          <button 
            onClick={fetchLongformPosts}
            disabled={loadingLongform}
            style="padding: 8px; border: 1px solid #444; background: #222; color: white; border-radius: 4px; cursor: pointer; flex-shrink: 0;"
          >
            {loadingLongform ? 'Loading...' : (<RotateCcw size={16} />)}
          </button>
        </div>

        <div style="margin: 8px 0;">
          {lastFetchedDatestamp && !loadingLongform && (
            <p style="color: #aaa; font-size: 11px;">
              {/* Tag: #{longformTag || 'any'} |  */}
              Last fetched ({longformPosts.length}) @ {lastFetchedDatestamp}
            </p>
          )}
        </div>

        <div style="max-height: 80vh; overflow-y: auto;">
          {longformPosts.length === 0 && !loadingLongform && (
            <p style="color: #aaa;">No posts found.</p>
          )}
          
          {longformPosts.map(post => (
            <div 
              key={post.id} 
              class="postContainer"
              style="border: 1px solid #444; margin: 8px 0; padding: 12px; border-radius: 8px; margin-bottom: 64px;"
            >
              <div style="margin-bottom: 8px;">
                <h4 style="margin: 0; color: #fff;">
                  {post.title}
                  {post.kind === 30818 && (
                    <span style="margin-left: 8px; font-size: 0.7em; color: #888; font-weight: normal;">
                      [Wiki]
                    </span>
                  )}
                </h4>
                <div style="font-size: 0.8em; color: #aaa; margin-top: 4px;">
                  by @anon#{post.pubkey.slice(-4)} • {new Date(post.published_at * 1000).toLocaleDateString()}
                  {/* {post.wikiId && (
                    <span style="margin-left: 8px;">
                      • ID: {post.wikiId}
                    </span>
                  )} */}
                </div>
              </div>
              
              {post.summary && (
                <div style="margin: 8px 0; color: #ccc; font-style: italic;">
                  {post.summary}
                </div>
              )}
              
              <div style="margin: 8px 0; font-size: 0.9em; line-height: 1.4; word-wrap: break-word;">
                {post.content}
              </div>

              {post.altText && (
                <div style="margin: 8px 0; font-size: 0.9em; line-height: 1.4; word-wrap: break-word; color: #888; font-style: italic;">
                  {post.altText}
                </div>
              )}
              
              <div style="font-size: 0.8em; color: #888;">
                Tags: {post.tags.filter(t => t[0] === 't').map(t => (
                  <button
                    key={t[1]}
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
                    onClick={() => setLongformTag(t[1])}
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