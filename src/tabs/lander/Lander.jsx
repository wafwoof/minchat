

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
          This is a minimal nostr client (kind 1). It is also compatible with bitchat (kind 20000/23333) and supports end-to-end encryption (E2EE) using AES-GCM.
        </p>
        {/* <br />
        <p>
          Note: You can enter a channel name by clicking on the channel name in the top-right. 
        </p> */}
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