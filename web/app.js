(() => {
  const $ = (id) => document.getElementById(id);
  const logs = $("logs");
  const log = (msg, type = "info") => {
    const t = new Date().toISOString().split("T")[1].replace("Z", "");
    logs.textContent += `[${t}] ${msg}\n`;
    logs.scrollTop = logs.scrollHeight;
    if (type === "error") console.error(msg);
    else console.log(msg);
  };

  const state = {
    provider: null,
    signer: null,
    account: null,
    config: window.BUNE_CONFIG || {},
    usdc: null,
    bune: null,
  };

  const IERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ];

  const BUNE_ABI = [
    "function entryAmount() view returns (uint256)",
    "function currentRound() view returns (uint256)",
    "function getPot(uint256) view returns (uint256)",
    "function getWinningNumber(uint256) view returns (uint8)",
    "function enter(uint8)",
    "function requestDraw(uint256)",
    "function finalize(uint256)",
    "function claim(uint256)",
  ];

  function saveFormToConfig() {
    state.config.usdc = $("usdcAddr").value.trim();
    state.config.bune = $("buneAddr").value.trim();
    window.BUNE_CONFIG = state.config;
    log("Saved addresses to in-memory config.");
  }

  function loadConfigToForm() {
    if (!state.config) return;
    $("usdcAddr").value = state.config.usdc || "";
    $("buneAddr").value = state.config.bune || "";
    log("Loaded addresses from config.js (if present).");
  }

  async function connect() {
    if (!window.ethereum) {
      alert("No wallet found. Install MetaMask.");
      return;
    }
    state.provider = new ethers.BrowserProvider(window.ethereum, {
      chainId: state.config.chainId || 31337,
    });
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    state.account = ethers.getAddress(accounts[0]);
    state.signer = await state.provider.getSigner();
    $("account").textContent = state.account;

    await bindContracts();
    await refreshStatus();
    log("Wallet connected.");
  }

  async function bindContracts() {
    try {
      if (!state.config.usdc || !state.config.bune) return;
      state.usdc = new ethers.Contract(state.config.usdc, IERC20_ABI, state.signer);
      state.bune = new ethers.Contract(state.config.bune, BUNE_ABI, state.signer);
    } catch (e) {
      log(`Contract bind error: ${e}`, "error");
    }
  }

  async function refreshStatus() {
    if (!state.bune) return;
    try {
      const entryAmt = await state.bune.entryAmount();
      const roundNow = await state.bune.currentRound();
      const potNow = await state.bune.getPot(roundNow);
      $("entryAmt").textContent = entryAmt.toString();
      $("roundNow").textContent = roundNow.toString();
      $("potNow").textContent = potNow.toString();
    } catch (e) {
      log(`refresh error: ${e}`, "error");
    }
  }

  async function approve() {
    if (!state.usdc || !state.bune) return alert("Missing addresses");
    try {
      const entryAmt = await state.bune.entryAmount();
      const tx = await state.usdc.approve(state.config.bune, entryAmt);
      log(`Approve tx sent: ${tx.hash}`);
      await tx.wait();
      log("Approve confirmed.");
      $("playMsg").textContent = "Approved.";
    } catch (e) {
      log(`approve error: ${e}`, "error");
      $("playMsg").textContent = `Error: ${e?.shortMessage || e}`;
    }
  }

  async function enter() {
    if (!state.bune) return alert("Missing Bune address");
    const pick = parseInt($("pick").value, 10);
    if (!(pick >= 1 && pick <= 100)) return alert("Pick 1-100");
    try {
      const tx = await state.bune.enter(pick);
      log(`Enter tx: ${tx.hash}`);
      await tx.wait();
      log("Entered round.");
      $("playMsg").textContent = "Entered.";
      await refreshStatus();
    } catch (e) {
      log(`enter error: ${e}`, "error");
      $("playMsg").textContent = `Error: ${e?.shortMessage || e}`;
    }
  }

  async function draw() {
    if (!state.bune) return;
    const r = parseInt($("roundInput").value || "0", 10);
    if (Number.isNaN(r)) return alert("Round required");
    try {
      const tx = await state.bune.requestDraw(r);
      log(`Draw tx: ${tx.hash}`);
      await tx.wait();
      const wn = await state.bune.getWinningNumber(r);
      $("winning").textContent = wn.toString();
      await refreshStatus();
    } catch (e) {
      log(`draw error: ${e}`, "error");
    }
  }

  async function finalize() {
    if (!state.bune) return;
    const r = parseInt($("roundInput").value || "0", 10);
    if (Number.isNaN(r)) return alert("Round required");
    try {
      const tx = await state.bune.finalize(r);
      log(`Finalize tx: ${tx.hash}`);
      await tx.wait();
      log("Finalized.");
      await refreshStatus();
    } catch (e) {
      log(`finalize error: ${e}`, "error");
    }
  }

  async function claim() {
    if (!state.bune) return;
    const r = parseInt($("claimRound").value || "0", 10);
    if (Number.isNaN(r)) return alert("Round required");
    try {
      const tx = await state.bune.claim(r);
      log(`Claim tx: ${tx.hash}`);
      await tx.wait();
      $("claimMsg").textContent = "Claimed.";
      await refreshStatus();
    } catch (e) {
      log(`claim error: ${e}`, "error");
      $("claimMsg").textContent = `Error: ${e?.shortMessage || e}`;
    }
  }

  // Wire UI
  window.addEventListener('DOMContentLoaded', () => {
    loadConfigToForm();
    $("connectBtn").onclick = connect;
    $("saveCfg").onclick = () => { saveFormToConfig(); bindContracts(); };
    $("loadCfg").onclick = loadConfigToForm;
    $("approveBtn").onclick = approve;
    $("enterBtn").onclick = enter;
    $("drawBtn").onclick = draw;
    $("finalizeBtn").onclick = finalize;
    $("claimBtn").onclick = claim;
  });
})();

