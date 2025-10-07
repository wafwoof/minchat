import { ArrowBigLeft, RotateCcw, Telescope } from 'lucide-preact';

export default function ExploreTab({ 
  config, poolRef, exploreTabOpen, setexploreTabOpen, longformPosts, 
  setLongformPosts, loadingLongform, setLoadingLongform, lastFetchedDatestamp, setLastFetchedDatestamp,
  longformTag, setLongformTag
}) {
  async function fetchLongformPosts() {
    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }
    
    setLoadingLongform(true);
    setLongformPosts([]);
    
    const now = Math.floor(Date.now() / 1000);
    const filter = {
      kinds: [30023], // longform content
      since: now - 604800, // last 7 days
      limit: 15
    };

    // only add tag filter if longformTag has a value
    if (longformTag && longformTag.trim()) {
      filter['#t'] = [longformTag];
    }

    const sub = poolRef.current.subscribeMany(config.relays, filter, {
      onevent(e) {
        const post = {
          id: e.id,
          pubkey: e.pubkey,
          content: e.content,
          tags: e.tags,
          created_at: e.created_at,
          title: e.tags.find(t => t[0] === 'title')?.[1] || 'Untitled',
          summary: e.tags.find(t => t[0] === 'summary')?.[1] || '',
          published_at: e.tags.find(t => t[0] === 'published_at')?.[1] || e.created_at
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
            <h3>Longform Explorer</h3>
          </div>
          <button onClick={() => setexploreTabOpen(false)}>
            <ArrowBigLeft size={16} />
          </button>
        </div>
        
        <div style="margin: 8px 0; display: flex; gap: 8px; align-items: center;">
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
            style="padding: 8px 16px;"
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
            <p style="color: #aaa;">No posts loaded.</p>
          )}
          
          {longformPosts.map(post => (
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
                <div style="margin: 8px 0; color: #ccc; font-style: italic;">
                  {post.summary}
                </div>
              )}
              
              <div style="margin: 8px 0; font-size: 0.9em; line-height: 1.4; word-wrap: break-word;">
                {post.content}
                {/* {post.content.slice(0, 500)}
                {post.content.length > 500 && '...'} */}
              </div>
              
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