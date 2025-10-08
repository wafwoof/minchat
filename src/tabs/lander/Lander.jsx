

export default function SettingsTab({ generateKeys }) {
  return (
    <section class="appContainer">
      <div
        style="padding: 8px; max-width: 400px;"
      >
        <div class="logo">
          <img src="/favicon/favicon-96x96.png" alt="MinChat Logo" width="40" height="40" />
          <span>
            Minchat Demo
          </span>
        </div>
        <div style="height: 20px;" />
        <h3>Info</h3>
        <p>
          This is a simple hybrid nostr client. 6 event kinds are supported: Notes (1), Bitchat (20000/23333), Longform & Wiki Posts (30023/30818), and even Gift-Wrapped Direct Messages (1059).
        </p>
        <p>
          If you end up using the marketplace, please look into: monero, multisig, arbiters, reputation systems, tor, etc.
        </p>
        <br />
        <p>
          Minchat supports proof-of-work and simple end-to-end encryption (E2EE) for channels and direct messages using AES-GCM.
        </p>
        <br />
        <p>
          Note: this is mostly a demo/proof-of-concept, and comes with no warranty or guarantee of any kind. Use at your own risk.
        </p>
        <br />
        <p>
          Contact me if you have any questions or suggestions. Thanks.
        </p>
        <br />
        <br />
        <p>
          To signup to nostr, you simply need a keypair. Press the button below to begin.
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