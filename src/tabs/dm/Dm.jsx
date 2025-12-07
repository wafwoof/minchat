import styles from './Dm.module.css';
import { useState, useEffect, useRef } from 'preact/hooks';
import { X, SendHorizontal, User, MessageCircle, ArrowLeft, UserPlus, Check } from 'lucide-preact';
import { nip17, nip19 } from 'nostr-tools';

export default function DmTab({
  config, relays, poolRef,
  sk, pk, handle,
  setHandle, encryptionKey,
  e2eEnabled, setDmTabOpen
}) {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('minchat-dm-conversations');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // pre-populate with default conversation
    try {
      const defaultPubkey = nip19.decode('npub12hva8marxu56mlycsnfhhlnc4yexehhf2r0tzayyxcs2mz07nu0sklwvrh').data;
      return [{
        pubkey: defaultPubkey,
        name: `Minchat#${defaultPubkey.slice(-4)}`,
        lastMessage: "Official Minchat Account.",
        timestamp: Date.now()
      }];
    } catch (error) {
      console.error('Failed to decode default npub:', error);
      return [];
    }
  });
  
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newRecipient, setNewRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('minchat-dm-messages');
    return saved ? JSON.parse(saved) : {};
  });
  const [showConversationsList, setShowConversationsList] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [editHandleValue, setEditHandleValue] = useState('');
  const [unreadCounts, setUnreadCounts] = useState(() => {
    const saved = localStorage.getItem('minchat-dm-unread-counts');
    return saved ? JSON.parse(saved) : {};
  });
  const subRef = useRef(null);
  const globalSubRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('minchat-dm-conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('minchat-dm-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('minchat-dm-unread-counts', JSON.stringify(unreadCounts));
  }, [unreadCounts]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
      if (isMobile) {
        setShowConversationsList(false);
      }
      // mark conversation as read
      setUnreadCounts(prev => {
        const updated = { ...prev };
        delete updated[selectedConversation.pubkey];
        return updated;
      });
    }
    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, [selectedConversation]);

  // global subscription for all DMs to keep conversation list updated
  useEffect(() => {
    if (poolRef.current && pk && sk) {
      const filter = {
        kinds: [1059], // gift-wrapped DMs
        '#p': [pk],
        since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        limit: 1000
      };

      globalSubRef.current = poolRef.current.subscribeMany(relays.dm, filter, {
        onevent: async (event) => {
          try {
            const rumor = nip17.unwrapEvent(event, sk);
            
            if (rumor.kind !== 14) return;

            const newMessage = {
              id: rumor.id || event.id,
              pubkey: rumor.pubkey,
              content: rumor.content,
              time: new Date(rumor.created_at * 1000).toLocaleTimeString(),
              created_at: rumor.created_at,
              isSelf: false
            };

            // Check if message already exists before updating anything
            let isNewMessage = false;
            setMessages(prev => {
              const conversationMessages = prev[rumor.pubkey] || [];
              isNewMessage = !conversationMessages.some(msg => msg.id === newMessage.id);
              
              if (!isNewMessage) {
                return prev;
              }
              
              return {
                ...prev,
                [rumor.pubkey]: [...conversationMessages, newMessage].sort((a, b) => a.created_at - b.created_at)
              };
            });

            // Only mark as unread if it's a NEW message and not from selected conversation
            if (isNewMessage && (!selectedConversation || selectedConversation.pubkey !== rumor.pubkey)) {
              setUnreadCounts(prev => ({
                ...prev,
                [rumor.pubkey]: (prev[rumor.pubkey] || 0) + 1
              }));
            }

            // update conversations list
            setConversations(prev => {
              const exists = prev.find(c => c.pubkey === rumor.pubkey);
              if (!exists) {
                return [...prev, {
                  pubkey: rumor.pubkey,
                  name: `User#${rumor.pubkey.slice(-4)}`,
                  lastMessage: rumor.content,
                  timestamp: rumor.created_at * 1000
                }];
              }
              
              // only update if this message is newer
              const existingConv = prev.find(c => c.pubkey === rumor.pubkey);
              if (existingConv && existingConv.timestamp < rumor.created_at * 1000) {
                return prev.map(c => 
                  c.pubkey === rumor.pubkey
                    ? { ...c, lastMessage: rumor.content, timestamp: rumor.created_at * 1000 }
                    : c
                );
              }
              return prev;
            });
          } catch (error) {
            console.error('Failed to unwrap gift wrap:', error);
          }
        }
      });
    }

    return () => {
      if (globalSubRef.current) globalSubRef.current.close();
    };
  }, [pk, sk, poolRef.current]);

  const loadMessages = () => {
    if (!selectedConversation || !poolRef.current) return;

    if (subRef.current) subRef.current.close();

    // const now = Math.floor(Date.now() / 1000);
    const filter = {
      kinds: [1059], // gift-wrapped DMs
      '#p': [pk],
      since: 0,
      limit: 500
    };

    subRef.current = poolRef.current.subscribeMany(relays.dm, filter, {
      onevent: async (event) => {
        // console.log('Received gift wrap event:', event);
        try {
          const rumor = nip17.unwrapEvent(event, sk);
          if (rumor.kind !== 14) {
            console.log('Not a DM event, skipping');
            return;
          }

          const isFromSelectedConversation = rumor.pubkey === selectedConversation.pubkey;          
          // console.log('Is message from selected conversation?', isFromSelectedConversation);
          
          const newMessage = {
            id: rumor.id || event.id,
            pubkey: rumor.pubkey,
            content: rumor.content,
            time: new Date(rumor.created_at * 1000).toLocaleTimeString(),
            created_at: rumor.created_at,
            isSelf: false
          };

          let isNewMessage = false;
          setMessages(prev => {
            const conversationKey = rumor.pubkey;
            const conversationMessages = prev[conversationKey] || [];
            
            isNewMessage = !conversationMessages.some(msg => msg.id === newMessage.id);
            
            if (!isNewMessage) {
              return prev;
            }
            
            const updated = {
              ...prev,
              [conversationKey]: [...conversationMessages, newMessage].sort((a, b) => a.created_at - b.created_at)
            };
            
            return updated;
          });

          // Only mark as unread if NEW message and not from selected conversation
          if (isNewMessage && !isFromSelectedConversation) {
            setUnreadCounts(prev => ({
              ...prev,
              [rumor.pubkey]: (prev[rumor.pubkey] || 0) + 1
            }));
          }

          if (!isFromSelectedConversation) {
            setConversations(prev => {
              const exists = prev.find(c => c.pubkey === rumor.pubkey);
              if (!exists) {
                console.log('Creating new conversation for:', rumor.pubkey);
                return [...prev, {
                  pubkey: rumor.pubkey,
                  name: `User#${rumor.pubkey.slice(-4)}`,
                  lastMessage: rumor.content,
                  timestamp: rumor.created_at * 1000
                }];
              }
              return prev.map(c => 
                c.pubkey === rumor.pubkey
                  ? { ...c, lastMessage: rumor.content, timestamp: rumor.created_at * 1000 }
                  : c
              );
            });
          }
          
          if (isFromSelectedConversation) {
            setConversations(prev => prev.map(c => 
              c.pubkey === selectedConversation.pubkey
                ? { ...c, lastMessage: rumor.content, timestamp: rumor.created_at * 1000 }
                : c
            ));
          }
        } catch (error) {
          console.error('Failed to unwrap gift wrap:', error);
          console.error('Event that failed:', event);
        }
      },
      oneose: () => {
        // console.log('End of stored events');
      }
    });
  };

  const startConversation = (pubkey, name = null) => {
    const existingConv = conversations.find(c => c.pubkey === pubkey);
    if (existingConv) {
      setSelectedConversation(existingConv);
      return;
    }

    const newConv = {
      pubkey,
      name: name || `User#${pubkey.slice(-4)}`,
      lastMessage: null,
      timestamp: Date.now()
    };

    setConversations(prev => [...prev, newConv]);
    setSelectedConversation(newConv);
  };

  const updateConversationHandle = () => {
    if (!editHandleValue.trim() || !selectedConversation) return;
    
    setConversations(prev => prev.map(c => 
      c.pubkey === selectedConversation.pubkey
        ? { ...c, name: editHandleValue.trim() }
        : c
    ));
    
    setSelectedConversation(prev => ({
      ...prev,
      name: editHandleValue.trim()
    }));
    
    setIsEditingHandle(false);
    setEditHandleValue('');
  };

  const startEditingHandle = () => {
    if (selectedConversation) {
      setEditHandleValue(selectedConversation.name);
      setIsEditingHandle(true);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedConversation || !sk) return;

    try {
      const recipient = {
        publicKey: selectedConversation.pubkey
      };

      const giftWrap = nip17.wrapEvent(
        sk, 
        recipient, 
        message.trim()
      );
      
      const newMessage = {
        id: `temp-${Date.now()}`,
        pubkey: pk,
        content: message.trim(),
        time: new Date().toLocaleTimeString(),
        created_at: Math.floor(Date.now() / 1000),
        isSelf: true
      };
      
      setMessages(prev => ({
        ...prev,
        [selectedConversation.pubkey]: [
          ...(prev[selectedConversation.pubkey] || []),
          newMessage
        ]
      }));
      
      await poolRef.current.publish(relays.dm, giftWrap);
      
      setConversations(prev => prev.map(c => 
        c.pubkey === selectedConversation.pubkey 
          ? { ...c, lastMessage: message, timestamp: Date.now() }
          : c
      ));

      setMessage('');
    } catch (error) {
      console.error('Failed to send DM:', error);
      alert('Failed to send message');
    }
  };

  const addNewConversation = () => {
    if (!newRecipient.trim()) return;
    
    let pubkey = newRecipient.trim();
    
    // convert npub to hex if needed
    if (pubkey.startsWith('npub')) {
      try {
        pubkey = nip19.decode(pubkey).data;
      } catch (error) {
        alert('Invalid npub format');
        return;
      }
    }
    
    // validate hex pubkey
    if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
      alert('Please enter a valid public key (64-character hex or npub)');
      return;
    }

    startConversation(pubkey);
    setNewRecipient('');
  };

  const backToConversations = () => {
    setSelectedConversation(null);
    setShowConversationsList(true);
  };

  return (
    <section class="appContainer">
      <div class="keyContainer">
        <div class={styles.leftHeader}>
          {isMobile && selectedConversation && !showConversationsList ? (
            <button
              onClick={backToConversations}
              class={styles.backButton}
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}
          {isEditingHandle ? (
            <div class={styles.editHandleContainer}>
              <input
                type="text"
                value={editHandleValue}
                onInput={(e) => setEditHandleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateConversationHandle();
                  } else if (e.key === 'Escape') {
                    setIsEditingHandle(false);
                    setEditHandleValue('');
                  }
                }}
                class={`${styles.editHandleInput} ${isMobile ? styles.mobile : ''}`}
                autoFocus
              />
              <button
                onClick={updateConversationHandle}
                class={styles.editHandleButton}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setIsEditingHandle(false); setEditHandleValue(''); }}
                class={styles.editHandleButton}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <span 
              class={styles.handleDisplay}
              onClick={startEditingHandle}
              title="Click to edit handle"
            >
              {selectedConversation 
                ? `@${handle}#${pk?.slice(-4)} → @${selectedConversation.name}`
                : `@${handle}#${pk?.slice(-4)}`
              }
            </span>
          )}
        </div>
        <div class="right">
          <button
            onClick={() => setDmTabOpen(false)}
            class={styles.closeButton}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div class={`${styles.mainContainer} ${isMobile ? styles.mobile : ''}`}>
        <div 
          class={`${styles.conversationsPanel} ${isMobile ? `${styles.mobile} ${showConversationsList || !selectedConversation ? '' : styles.hidden}` : styles.desktop}`}
        >
          <div 
            class={styles.newConversationContainer}
          >
            <input
              type="text"
              value={newRecipient}
              onInput={(e) => setNewRecipient(e.target.value)}
              placeholder="Enter the user's pubkey"
              class={`${styles.newConversationInput} ${isMobile ? styles.mobile : ''}`}
            />
            <button
              onClick={addNewConversation}
              class={`${styles.addConversationButton} ${isMobile ? styles.mobile : ''}`}
            >
              <UserPlus size={16} />
            </button>
          </div>
          
          {conversations
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(conv => (
            <div
              key={conv.pubkey}
              onClick={() => setSelectedConversation(conv)}
              class={`${styles.conversationItem} ${selectedConversation?.pubkey === conv.pubkey ? styles.active : ''}`}
            >
              <div class={`${styles.conversationItemHeader} ${isMobile ? styles.mobile : styles.desktop}`}>
                <span>{conv.name}</span>
                {unreadCounts[conv.pubkey] > 0 && (
                  <div class={styles.unreadBadge}>
                    {unreadCounts[conv.pubkey] > 99 ? '99+' : unreadCounts[conv.pubkey]}
                  </div>
                )}
              </div>
              {conv.lastMessage && (
                <div class={`${styles.conversationItemPreview} ${isMobile ? styles.mobile : ''}`}>
                  {conv.lastMessage}
                </div>
              )}
            </div>
          ))}
        </div>

        <div 
          class={`${styles.messagesPanel} ${isMobile && selectedConversation && !showConversationsList ? styles.active : ''}`}
        >
          {selectedConversation ? (
            <>
              <div 
                class={styles.messagesContainer}
              >
                {(messages[selectedConversation.pubkey] || []).map(msg => (
                  <div
                    key={msg.id}
                    class={`${styles.message} ${msg.isSelf ? styles.sent : styles.received}`}
                  >
                    <div
                      class={`${styles.messageBubble} ${msg.isSelf ? styles.sent : styles.received} ${isMobile ? styles.mobile : ''}`}
                    >
                      {msg.content}
                    </div>
                    <div class={styles.messageTime}>
                      {msg.time}
                    </div>
                  </div>
                ))}
              </div>
              
              <div class={`${styles.userInputContainer} ${isMobile ? styles.mobile : ''}`}>
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
                  <input
                    type="text"
                    value={message}
                    onInput={(e) => setMessage(e.target.value)}
                    placeholder="Message"
                    style="flex: 1;"
                  />
                  <button 
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); }}
                    onTouchStart={(e) => { e.preventDefault(); sendMessage(); }}
                    class={styles.sendButton}
                  >
                    <SendHorizontal size={16} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div class={styles.emptyStateContainer}>
              {isMobile ? 'Select a conversation' : 'Select a conversation to start'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}