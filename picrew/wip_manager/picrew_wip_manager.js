// ==UserScript==
// @name         Picrew WIP manager
// @version      1.0.0
// @description  Save and manage WIPs on Picrew's image makers
// @author       7evy
// @run-at       document-idle
// @include      /^https://picrew\.me/(../)?image_maker/[0-9]+/
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  ///////////////////////////////
  // UI Setup
  ///////////////////////////////

  const uiHTML = `
    <div id="wip-toolbox">
      <input type="text" id="wip-name" placeholder="WIP name" />
      <button id="save-wip">💾 Save</button>
      <select id="wip-list"><option value="">-- Load WIP --</option></select>
      <button id="load-wip">📂 Load</button>
      <button id="delete-wip">🗑️ Delete</button>
    </div>
  `;

  const css = `
    #wip-toolbox {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      padding: 10px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      color: white;
      font-family: sans-serif;
    }
    #wip-toolbox input, #wip-toolbox select, #wip-toolbox button {
      margin: 3px 0;
      padding: 4px;
    }
    #wip-toolbox input, #wip-toolbox select {
      width: 120px;
    }
    #save-wip:hover {
      background: rgba(50,50,50,0.8);
    }
    #save-wip:active {
      background: rgba(100,100,100,0.8);
    }
    #load-wip:hover {
      background: rgba(50,50,50,0.8);
    }
    #load-wip:active {
      background: rgba(100,100,100,0.8);
    }
    #delete-wip:hover {
      background: rgba(50,50,50,0.8);
    }
    #delete-wip:active {
      background: rgba(100,100,100,0.8);
    }
  `;

  GM_addStyle(css);

  if (window.top === window.self) {
    document.body.insertAdjacentHTML('beforeend', uiHTML);
  }

  const saveButton = document.getElementById('save-wip');
  const loadButton = document.getElementById('load-wip');
  const deleteButton = document.getElementById('delete-wip');
  const wipInput = document.getElementById('wip-name');
  const wipSelect = document.getElementById('wip-list');

  function detectImageMakerId() {
    const match = location.href.match(/image_maker\/([0-9]+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  const imageMakerId = detectImageMakerId();
  if (!imageMakerId) return;
  const GMkey = `picrew_wips_${imageMakerId}`

  ///////////////////////////////
  // Event Listeners
  ///////////////////////////////

  saveButton.onclick = () => {
    const name = wipInput.value.trim();
    if (!name) return alert('A name is required');
    saveWIP(name);
  };

  loadButton.onclick = () => {
    const name = wipSelect.value;
    if (!name) return alert('Select a WIP to load');
    loadWIP(name);
    location.reload();
  };

  deleteButton.onclick = () => {
    const name = wipSelect.value;
    if (!name) return alert('Select a WIP to delete');
    deleteWIP(name);
  };

  ///////////////////////////////
  // WIP Logic
  ///////////////////////////////

  async function saveWIP(name) {
    const wipData = await exportParts(imageMakerId);
    const allWIPs = await GM_getValue(GMkey, {});
    allWIPs[name] = wipData;
    await GM_setValue(GMkey, allWIPs);
    refreshDropdown(allWIPs);
  }

  async function loadWIP(name) {
    const allWIPs = await GM_getValue(GMkey, {});
    const wip = allWIPs[name];
    if (!wip) return alert("WIP not found.");
    await restoreParts(wip);
  }

  async function deleteWIP(name) {
    const allWIPs = await GM_getValue(GMkey, {});
    delete allWIPs[name];
    await GM_setValue(GMkey, allWIPs);
    removeFromDropdown(name);
  }

  async function refreshDropdown(allWIPs) {
    wipSelect.innerHTML = `<option value="">-- Load WIP --</option>`;
    for (const name of Object.keys(allWIPs)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      wipSelect.appendChild(option);
    }
  }

  async function removeFromDropdown(name) {
    const option = wipSelect.querySelector(`option[value="${name}"]`);
    option.remove();
    wipSelect.selectedIndex = 0;
    wipSelect.dispatchEvent(new Event("option deleted"));
  }

  ///////////////////////////////
  // IndexedDB Access
  ///////////////////////////////

  // Picrew's image maker history is stored in the indexed DB under picrew > image_maker_parts
  function openPicrewDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("picrew");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function exportParts(imageMakerId) {
    const db = await openPicrewDB();
    const tx = db.transaction("image_maker_parts", "readonly");
    const store = tx.objectStore("image_maker_parts");

    return new Promise(resolve => {
      store.getAll().onsuccess = (valuesEvent) => resolve(valuesEvent.target.result);
    });
  }

  async function restoreParts(wipData) {
    const db = await openPicrewDB();
    const tx = db.transaction("image_maker_parts", "readwrite");
    const store = tx.objectStore("image_maker_parts");

    // keyPath is computed from value
    wipData.forEach((value) => store.put(value));

    return new Promise(resolve => {
      tx.oncomplete = resolve;
    });
  }

  ///////////////////////////////
  // Init
  ///////////////////////////////

  refreshDropdown(GM_getValue(GMkey, {}));
})();
