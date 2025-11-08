(() => {
  const $ = (id) => document.getElementById(id);
  const logs = $("logs");
  const log = (m) => { logs.textContent += m + "\n"; logs.scrollTop = logs.scrollHeight; };

  const state = { provider: null, signer: null, account: null, bune: null, cfg: window.BUNE_LITE_CONFIG || {} };

  const ABI = [
    "function currentRound() view returns (uint256)",
    "function getWinningNumber(uint256) view returns (uint8)",
    "function getPicksCount(uint256,uint8) view returns (uint256)",
    "function getPickAt(uint256,uint8,uint256) view returns (address)",
    "function enter(uint8)",
    "function requestDraw(uint256)",
    "function finalize(uint256)",
  ];

  async function connect() {
    if (!window.ethereum) { alert("Install MetaMask"); return; }
    state.provider = new ethers.BrowserProvider(window.ethereum, { chainId: state.cfg.chainId || 31337 });
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    state.account = ethers.getAddress(accounts[0]);
    state.signer = await state.provider.getSigner();
    $("account").textContent = state.account;
    state.bune = new ethers.Contract(state.cfg.bune, ABI, state.signer);
    await refresh();
    log("Connected");
  }

  async function refresh() {
    if (!state.bune) return;
    const r = await state.bune.currentRound();
    $("roundNow").textContent = r.toString();
  }

  async function enter() {
    try {
      const pick = parseInt($("pick").value, 10);
      if (!(pick >= 1 && pick <= 100)) return alert("Pick 1-100");
      const tx = await state.bune.enter(pick);
      log(`enter tx: ${tx.hash}`);
      await tx.wait();
      log("entered");
      await refresh();
    } catch (e) { log(`enter error: ${e}`); }
  }

  async function draw() {
    try {
      const r = parseInt($("roundInput").value || "0", 10);
      const tx = await state.bune.requestDraw(r);
      log(`draw tx: ${tx.hash}`);
      await tx.wait();
      const wn = await state.bune.getWinningNumber(r);
      $("winning").textContent = wn.toString();
    } catch (e) { log(`draw error: ${e}`); }
  }

  async function finalize() {
    try {
      const r = parseInt($("roundInput").value || "0", 10);
      const tx = await state.bune.finalize(r);
      log(`finalize tx: ${tx.hash}`);
      await tx.wait();
      log("finalized");
    } catch (e) { log(`finalize error: ${e}`); }
  }

  async function listWinners() {
    try {
      const r = parseInt($("winnersRound").value || "0", 10);
      const wn = await state.bune.getWinningNumber(r);
      $("winning").textContent = wn.toString();
      const count = await state.bune.getPicksCount(r, wn);
      $("winnersCount").textContent = count.toString();
      const list = $("winnersList");
      list.innerHTML = "";
      for (let i = 0; i < Number(count); i++) {
        const addr = await state.bune.getPickAt(r, wn, i);
        const li = document.createElement('li');
        li.textContent = addr;
        list.appendChild(li);
      }
    } catch (e) { log(`list error: ${e}`); }
  }

  window.addEventListener('DOMContentLoaded', () => {
    $("connectBtn").onclick = connect;
    $("enterBtn").onclick = enter;
    $("drawBtn").onclick = draw;
    $("finalizeBtn").onclick = finalize;
    $("listWinnersBtn").onclick = listWinners;
  });
})();

