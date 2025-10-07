

export default function SettingsTab({ generateKeys }) {
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
          This is a simple hybrid nostr client. 4 event kinds are supported: Notes (1), Bitchat (20000/23333), and longform posts (30023).
        </p>
        <br />
        <p>
          MinChat supports proof-of-work and simple (but pretty solid) end-to-end encryption (E2EE) for channels and direct messages using AES-GCM.
        </p>
        <br />
        <p>
          Note: tags are clickable in the longform explorer tab.
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