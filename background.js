// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Skip chrome:// and other restricted URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('file://')) {
    console.log('Cannot run on restricted URL:', tab.url);
    return;
  }

  // Get current state for this tab
  const result = await chrome.storage.local.get(`darkMode_${tab.id}`);
  const isEnabled = result[`darkMode_${tab.id}`] || false;
  const newState = !isEnabled;

  // Save new state
  await chrome.storage.local.set({ [`darkMode_${tab.id}`]: newState });

  // Update badge to show state
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: newState ? "ON" : ""
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId: tab.id,
    color: newState ? "#4CAF50" : "#666"
  });

  try {
    // Inject and execute content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    // Send message to content script with the new state
    await chrome.tabs.sendMessage(tab.id, {
      action: "toggleDarkMode",
      enabled: newState
    });
  } catch (error) {
    console.log('Cannot inject script:', error.message);
  }
});

// Clean up storage when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`darkMode_${tabId}`);
});
