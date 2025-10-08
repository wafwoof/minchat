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
    if (selectedConversation) {
      loadMessages();
      if (isMobile) {
        setShowConversationsList(false);
      }
    }
    return () => {
      if (subRef.current) subRef.current.close();
    };
  }, [selectedConversation]);

  // global subscription for all DMs to keep conversation list updated
  useEffect(() => {
    if (poolRef.current && pk && sk) {
      const filter = {
        kinds: [1059],
        '#p': [pk],
        since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        limit: 1000
      };

      // const relays = ['wss://tr7b9d5l-8080.usw2.devtunnels.ms'];
      // const relays = relays.dm;
      globalSubRef.current = poolRef.current.subscribeMany(relays.dm, filter, {
        onevent: async (event) => {
          try {
            const rumor = nip17.unwrapEvent(event, sk);
            
            if (rumor.kind !== 14) return;

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

            // update messages state
            const newMessage = {
              id: rumor.id || event.id,
              pubkey: rumor.pubkey,
              content: rumor.content,
              time: new Date(rumor.created_at * 1000).toLocaleTimeString(),
              created_at: rumor.created_at,
              isSelf: false
            };

            setMessages(prev => {
              const conversationMessages = prev[rumor.pubkey] || [];
              if (conversationMessages.some(msg => msg.id === newMessage.id)) {
                return prev;
              }
              return {
                ...prev,
                [rumor.pubkey]: [...conversationMessages, newMessage].sort((a, b) => a.created_at - b.created_at)
              };
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
      kinds: [1059],
      '#p': [pk],
      since: 0,
      limit: 500
    };

    // const relays = ['wss://tr7b9d5l-8080.usw2.devtunnels.ms'];
    // const relays = relays.dm;
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
          
          if (!isFromSelectedConversation) {
            // console.log('Message is from a different conversation:', rumor.pubkey);
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
          
          const newMessage = {
            id: rumor.id || event.id,
            pubkey: rumor.pubkey,
            content: rumor.content,
            time: new Date(rumor.created_at * 1000).toLocaleTimeString(),
            created_at: rumor.created_at,
            isSelf: false
          };
          // console.log('Adding message to state:', newMessage);

          setMessages(prev => {
            const conversationKey = rumor.pubkey;
            const conversationMessages = prev[conversationKey] || [];
            
            if (conversationMessages.some(msg => msg.id === newMessage.id)) {
              // console.log('Duplicate message, skipping');
              return prev;
            }
            
            const updated = {
              ...prev,
              [conversationKey]: [...conversationMessages, newMessage].sort((a, b) => a.created_at - b.created_at)
            };
            
            // console.log('Updated messages:', updated);
            return updated;
          });
          
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
      
      const relays = ['wss://tr7b9d5l-8080.usw2.devtunnels.ms'];
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
      
      await poolRef.current.publish(relays, giftWrap);
      
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
        <div class="left" style="display: flex; flex-direction: row; align-items: center;">
          {isMobile && selectedConversation && !showConversationsList ? (
            <button
              onClick={backToConversations}
              style="background: none; border: none; color: white; cursor: pointer; padding: 4px;"
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}
          {isEditingHandle ? (
            <div style="display: flex; align-items: center; margin-left: 8px;">
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
                style={`
                  padding: 4px 8px;
                  background: #111;
                  border: 1px solid #333;
                  color: white;
                  font-size: 13px;
                  font-family: inherit;
                  ${isMobile ? 'font-size: 14px;' : ''}
                `}
                autoFocus
              />
              <button
                onClick={updateConversationHandle}
                style="margin-left: 4px; padding: 4px 8px; cursor: pointer;"
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setIsEditingHandle(false); setEditHandleValue(''); }}
                style="margin-left: 4px; padding: 4px 8px; cursor: pointer;"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <span 
              style="margin-left: 8px; cursor: pointer;"
              onClick={startEditingHandle}
              title="Click to edit handle"
            >
              {selectedConversation 
                // && !showConversationsList 
                ? `@${handle}#${pk?.slice(-4)} → @${selectedConversation.name}`
                : `@${handle}#${pk?.slice(-4)}`
              }
            </span>
          )}
        </div>
        <div class="right">
          <button
            onClick={() => setDmTabOpen(false)}
            style="background: none; border: none; color: white; cursor: pointer; padding: 4px;"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={`display: flex; height: calc(100vh - 31px); width: 100%; ${isMobile ? 'flex-direction: column;' : ''}`}>
        <div 
          style={`
            ${isMobile 
              ? (showConversationsList || !selectedConversation ? 'display: block;' : 'display: none;') 
              : 'width: 250px; border-right: 1px solid #333;'
            } 
            ${isMobile ? 'height: 100%;' : ''} 
            overflow-y: auto;
          `}
        >
          <div style="display: flex; flex-direction: row; padding: 12px; border-bottom: 1px solid #333;">
            <input
              type="text"
              value={newRecipient}
              onInput={(e) => setNewRecipient(e.target.value)}
              placeholder="Enter the user's pubkey"
              style={`
                width: 100%; 
                margin-bottom: 0px; 
                padding: 8px; 
                background: #111; 
                border: 1px solid #333; 
                color: white; 
                border-radius: 0;
                font-family: inherit;
                ${isMobile ? 'font-size: 16px;' : ''}
              `}
            />
            <button
              onClick={addNewConversation}
              style={`
                width: 50px;
                padding: 8px;
                background: #333;
                border: 1px solid #444;
                color: white; 
                border-radius: 0; 
                cursor: pointer;
                font-family: inherit;
                ${isMobile ? 'font-size: 16px; touch-action: manipulation;' : ''}
              `}
            >
              <UserPlus size={16} />
            </button>
          </div>
          
          {/* {conversations.map(conv => ( */}
          {conversations
          .sort((a, b) => b.timestamp - a.timestamp)
          .map(conv => (
            <div
              key={conv.pubkey}
              onClick={() => setSelectedConversation(conv)}
              style={`
                padding: 12px; 
                cursor: pointer; 
                border-bottom: 1px solid #333;
                background: ${selectedConversation?.pubkey === conv.pubkey ? '#2a2a2a' : 'transparent'};
                touch-action: manipulation;
              `}
            >
              <div style={`font-weight: normal; margin-bottom: 2px; ${isMobile ? 'font-size: 14px;' : 'font-size: 13px;'}`}>
                {conv.name}
              </div>
              {conv.lastMessage && (
                <div style={`
                  font-size: ${isMobile ? '13px' : '12px'}; 
                  color: #666; 
                  overflow: hidden; 
                  text-overflow: ellipsis; 
                  white-space: nowrap;
                `}>
                  {conv.lastMessage}
                </div>
              )}
            </div>
          ))}
        </div>

        <div 
          class="dmMessagesContainer"
          style={`
            flex: 1; 
            display: flex; 
            flex-direction: column;
            ${isMobile 
              ? (selectedConversation && !showConversationsList ? 'display: flex;' : 'display: none;') 
              : ''
            }
          `}
        >
          {selectedConversation ? (
            <>
              <div 
                class="messagesContainer" 
                style={`
                  max-height: calc(100dvh - 73px);
                  flex: 1; 
                  flex-direction: column;
                  justify-content: flex-end;
                  overflow-y: auto; 
                  padding: 8px;
                  border-top: none;
                `}
              >
                {(messages[selectedConversation.pubkey] || []).map(msg => (
                  <div
                    key={msg.id}
                    class="message"
                    style={`
                      margin-bottom: 8px;
                      text-align: ${msg.isSelf ? 'right' : 'left'};
                    `}
                  >
                    <div
                      style={`
                        display: inline-block;
                        max-width: ${isMobile ? '85%' : '70%'};
                        padding: 8px;
                        background: ${msg.isSelf ? '#2a2a2a' : '#222'};
                        color: white;
                        font-size: 14px;
                        word-wrap: break-word;
                      `}
                    >
                      {msg.content}
                    </div>
                    <div style={`
                      font-size: 11px; 
                      color: #555; 
                      margin-top: 2px;
                    `}>
                      {msg.time}
                    </div>
                  </div>
                ))}
              </div>
              
              <div class="userInputContainer" style={`
                border-top: 1px solid #333;
                ${isMobile ? 'padding-bottom: calc(0px + env(safe-area-inset-bottom));' : ''}
              `}>
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
                    // onClick={() => { sendMessage(); }}
                    class="sendButton"
                  >
                    <SendHorizontal size={16} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={`
              flex: 1; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: #666;
              padding: 20px;
              text-align: center;
              font-size: 13px;
            `}>
              {isMobile ? 'Select a conversation' : 'Select a conversation to start'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}