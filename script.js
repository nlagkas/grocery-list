// ============================================================================
// GROCERY LIST APPLICATION
// ============================================================================
// A collaborative grocery shopping app with Firebase backend.
// Features: list management, favorites, categories, and shopping mode.
// ============================================================================

// ============================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.appspot.com",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
  };
  
  // Initialize Firebase services
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // ============================================================================
  // 2. DOM ELEMENT REFERENCES
  // ============================================================================
  
  // Authentication elements
  const loginButton = document.getElementById('login-button');
  const unauthorizedLogoutButton = document.getElementById('unauthorized-logout-button');
  const logoutButton = document.getElementById('logout-button');
  const userNameSpan = document.getElementById('user-name');
  const unauthorizedUserId = document.getElementById('unauthorized-user-id');
  
  // List display elements
  const listTitle = document.getElementById('list-title');
  const shoppingModeToggle = document.getElementById('shopping-mode-toggle');
  const completeListButton = document.getElementById('complete-list-button');
  
  // Item input form elements
  const itemNameInput = document.getElementById('item-name-input');
  const itemQuantityInput = document.getElementById('item-quantity-input');
  const itemNotesInput = document.getElementById('item-notes-input');
  const saveFavoriteCheckbox = document.getElementById('save-favorite-checkbox');
  const addButton = document.getElementById('add-button');
  const addButtonText = document.getElementById('add-button-text');
  
  // List container elements
  const shoppingListUl = document.getElementById('shopping-list-ul');
  const completedListUl = document.getElementById('completed-list-ul');
  const lookLaterSection = document.getElementById('look-later-section');
  const lookLaterListUl = document.getElementById('look-later-list-ul');
  const pastListsUl = document.getElementById('past-lists-ul');
  
  // Favorites elements
  const favoritesContainer = document.getElementById('favorites-container');
  const favoritesCategoryTabs = document.getElementById('favorites-category-tabs');
  const manageFavoritesButton = document.getElementById('manage-favorites-button');
  
  // Modal elements
  const favoritesModalOverlay = document.getElementById('favorites-modal-overlay');
  const closeModalButton = document.getElementById('close-modal-button');
  const modalFavoritesList = document.getElementById('modal-favorites-list');
  const newCategoryInput = document.getElementById('new-category-input');
  const addCategoryButton = document.getElementById('add-category-button');
  
  // ============================================================================
  // 3. APPLICATION STATE
  // ============================================================================
  
  // Active list tracking
  let activeListId = null;
  
  // Firestore real-time listeners (for cleanup)
  let unsubscribeFromItems = null;
  let unsubscribeFromLists = null;
  let unsubscribeFromFavorites = null;
  let unsubscribeFromCategories = null;
  
  // Cached data for UI rendering
  let favoritesCache = [];
  let categoriesCache = [];
  
  // UI state
  let editingFavoriteId = null; // Track when editing a favorite item
  let activeCategoryId = 'all'; // Currently selected category filter
  
  // ============================================================================
  // 4. UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Format a Firestore timestamp to a readable Greek date string
   * @param {Object} timestamp - Firestore timestamp object
   * @returns {string} Formatted date string (e.g., "15 Δεκεμβρίου 2024")
   */
  function formatDate(timestamp) {
    if (!timestamp) return '...';
    
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("el-GR", {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  
  /**
   * Reset the add item form to its default state
   */
  function resetAddItemForm() {
    itemNameInput.value = '';
    itemQuantityInput.value = '';
    itemNotesInput.value = '';
    saveFavoriteCheckbox.checked = false;
    editingFavoriteId = null;
    addButtonText.textContent = 'Προσθήκη στη Λίστα';
    saveFavoriteCheckbox.parentElement.style.display = 'flex';
    itemNameInput.focus();
  }
  
  // ============================================================================
  // 5. LIST MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Load and display a shopping list with real-time updates
   * @param {Object} listDoc - Firestore document snapshot of the list
   */
  function loadList(listDoc) {
    activeListId = listDoc.id;
    listTitle.textContent = `Λίστα: ${formatDate(listDoc.data().createdAt)}`;
    
    // Unsubscribe from previous list's items if any
    if (unsubscribeFromItems) {
      unsubscribeFromItems();
    }
    
    // Set up real-time listener for items in this list
    const itemsRef = db.collection('lists')
      .doc(activeListId)
      .collection('items');
    
    unsubscribeFromItems = itemsRef.orderBy('name').onSnapshot(snapshot => {
      // Clear all lists
      shoppingListUl.innerHTML = '';
      completedListUl.innerHTML = '';
      lookLaterListUl.innerHTML = '';
      
      // Populate lists based on item status
      snapshot.forEach(doc => {
        const item = doc.data();
        const itemId = doc.id;
        
        // Create list item with controls
        const li = document.createElement('li');
        li.innerHTML = `
          <input type="checkbox" 
                 class="item-checkbox" 
                 data-id="${itemId}" 
                 ${item.status === 'completed' ? 'checked' : ''}>
          <div class="item-content">
            <div class="item-name">${item.name}</div>
            <div class="item-details">
              ${item.quantity ? `<span class="quantity">${item.quantity}</span>` : ''}
              ${item.notes ? `<span class="notes">${item.notes}</span>` : ''}
            </div>
          </div>
          <button class="cant-find-button" data-id="${itemId}">?</button>
          <button class="delete-button" data-id="${itemId}">&times;</button>
        `;
        
        // Add to appropriate list based on status
        if (item.status === 'completed') {
          completedListUl.appendChild(li);
        } else if (item.status === 'later') {
          lookLaterListUl.appendChild(li);
        } else {
          shoppingListUl.appendChild(li);
        }
      });
      
      // Show/hide "Look Later" section based on content
      lookLaterSection.classList.toggle('empty', lookLaterListUl.children.length === 0);
    });
  }
  
  /**
   * Create a new active shopping list
   */
  async function createNewList() {
    console.log("Creating a new list...");
    shoppingListUl.innerHTML = '<li>Δημιουργία νέας λίστας...</li>';
    completedListUl.innerHTML = '';
    
    // Create new list document
    const newList = {
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      completedAt: null
    };
    
    const newListRef = await db.collection('lists').add(newList);
    const newListDoc = await newListRef.get();
    
    loadList(newListDoc);
  }
  
  /**
   * Complete the current list and create a new one
   */
  async function completeCurrentList() {
    if (!activeListId) return;
    
    if (!confirm('Είστε σίγουροι ότι θέλετε να ολοκληρώσετε αυτή τη λίστα;')) {
      return;
    }
    
    // Mark current list as completed
    const currentListRef = db.collection('lists').doc(activeListId);
    await currentListRef.update({
      isActive: false,
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Clean up and reset
    if (unsubscribeFromItems) {
      unsubscribeFromItems();
    }
    
    activeListId = null;
    shoppingListUl.innerHTML = '';
    completedListUl.innerHTML = '';
    lookLaterListUl.innerHTML = '';
    
    // Create a fresh list
    await createNewList();
  }
  
  // ============================================================================
  // 6. ITEM MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Add a new item to the list or update an existing favorite
   */
  function addItemOrUpdateFavorite() {
    const itemName = itemNameInput.value.trim();
    if (!itemName) return;
    
    const itemQuantity = itemQuantityInput.value.trim();
    const itemNotes = itemNotesInput.value.trim();
    
    // If editing a favorite, update it instead of adding to list
    if (editingFavoriteId) {
      db.collection('favorites').doc(editingFavoriteId).set({
        name: itemName,
        quantity: itemQuantity,
        notes: itemNotes
      }).then(() => {
        resetAddItemForm();
      });
      return;
    }
    
    // Add to active shopping list
    if (activeListId) {
      db.collection('lists')
        .doc(activeListId)
        .collection('items')
        .add({
          name: itemName,
          quantity: itemQuantity,
          notes: itemNotes,
          status: 'pending'
        });
    }
    
    // Optionally save as favorite
    if (saveFavoriteCheckbox.checked) {
      const favoriteId = itemName.toLowerCase();
      db.collection('favorites').doc(favoriteId).set({
        name: itemName,
        quantity: itemQuantity,
        notes: itemNotes,
        categoryId: null
      }, { merge: true });
    }
    
    resetAddItemForm();
  }
  
  /**
   * Handle clicks on list items (checkbox, delete, can't find)
   * @param {Event} e - Click event
   */
  function handleListClick(e) {
    const target = e.target;
    
    if (!activeListId || !target.dataset.id) return;
    
    const itemsRef = db.collection('lists')
      .doc(activeListId)
      .collection('items');
    const itemId = target.dataset.id;
    
    // Toggle item completion status
    if (target.classList.contains('item-checkbox')) {
      const newStatus = target.checked ? 'completed' : 'pending';
      itemsRef.doc(itemId).update({ status: newStatus });
    }
    
    // Delete item
    if (target.classList.contains('delete-button')) {
      if (confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το προϊόν;')) {
        itemsRef.doc(itemId).delete();
      }
    }
    
    // Move item to "look later" list
    if (target.classList.contains('cant-find-button')) {
      itemsRef.doc(itemId).update({ status: 'later' });
    }
  }
  
  // ============================================================================
  // 7. FAVORITES MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Render favorites panel with category tabs and favorite buttons
   */
  function renderFavorites() {
    // --- Render Category Tabs ---
    favoritesCategoryTabs.innerHTML = '';
    
    // "All" tab
    const allTab = document.createElement('button');
    allTab.className = 'category-tab';
    allTab.textContent = 'Όλα';
    allTab.dataset.id = 'all';
    if (activeCategoryId === 'all') {
      allTab.classList.add('active');
    }
    favoritesCategoryTabs.appendChild(allTab);
    
    // "No Category" tab
    const noCategoryTab = document.createElement('button');
    noCategoryTab.className = 'category-tab';
    noCategoryTab.textContent = 'Χωρίς Κατηγορία';
    noCategoryTab.dataset.id = 'none';
    if (activeCategoryId === 'none') {
      noCategoryTab.classList.add('active');
    }
    favoritesCategoryTabs.appendChild(noCategoryTab);
    
    // Category tabs
    categoriesCache.forEach(cat => {
      const tab = document.createElement('button');
      tab.className = 'category-tab';
      tab.textContent = cat.name;
      tab.dataset.id = cat.id;
      if (cat.id === activeCategoryId) {
        tab.classList.add('active');
      }
      favoritesCategoryTabs.appendChild(tab);
    });
    
    // --- Render Favorite Buttons ---
    favoritesContainer.innerHTML = '';
    
    // Filter favorites based on active category
    const filteredFavorites = favoritesCache.filter(fav => {
      if (activeCategoryId === 'all') return true;
      if (activeCategoryId === 'none') return !fav.categoryId;
      return fav.categoryId === activeCategoryId;
    });
    
    // Create button for each favorite
    filteredFavorites.forEach(fav => {
      const button = document.createElement('button');
      button.className = 'favorite-button';
      button.textContent = fav.name;
      button.dataset.id = fav.id;
      favoritesContainer.appendChild(button);
    });
  }
  
  /**
   * Open the favorites management modal
   */
  function openFavoritesModal() {
    modalFavoritesList.innerHTML = '';
    
    // Populate modal with all favorites
    favoritesCache.forEach(fav => {
      const li = document.createElement('li');
      
      // Build category dropdown options
      let optionsHtml = `<option value="">-- Επιλογή --</option>`;
      categoriesCache.forEach(cat => {
        const selected = fav.categoryId === cat.id ? 'selected' : '';
        optionsHtml += `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
      });
      
      li.innerHTML = `
        <span class="item-content">${fav.name}</span>
        <div class="item-actions">
          <select class="modal-category-select" data-id="${fav.id}">
            ${optionsHtml}
          </select>
          <div class="modal-actions">
            <button class="modal-edit-btn" data-id="${fav.id}">Επεξεργασία</button>
            <button class="modal-delete-btn" data-id="${fav.id}">Διαγραφή</button>
          </div>
        </div>
      `;
      
      modalFavoritesList.appendChild(li);
    });
    
    favoritesModalOverlay.style.display = 'block';
  }
  
  /**
   * Close the favorites management modal
   */
  function closeFavoritesModal() {
    favoritesModalOverlay.style.display = 'none';
    
    // If we were editing, reset the form
    if (editingFavoriteId) {
      resetAddItemForm();
    }
  }
  
  /**
   * Add a new category
   */
  function addCategory() {
    const categoryName = newCategoryInput.value.trim();
    
    if (categoryName) {
      const categoryId = categoryName.toLowerCase();
      
      db.collection('categories').doc(categoryId).set({
        name: categoryName
      }).then(() => {
        newCategoryInput.value = '';
      }).catch(err => {
        console.error("Error adding category: ", err);
      });
    }
  }
  
  // ============================================================================
  // 8. PAST LISTS MANAGEMENT
  // ============================================================================
  
  /**
   * Handle expansion/collapse of past list items
   * @param {Event} e - Click event
   */
  async function handlePastListClick(e) {
    if (!e.target.classList.contains('past-list-header')) return;
    
    const header = e.target;
    const listId = header.dataset.id;
    const itemsUl = header.nextElementSibling;
    
    // Toggle open state
    header.classList.toggle('open');
    const isOpen = header.classList.contains('open');
    
    // Load items if opening for the first time
    if (isOpen && itemsUl.children.length === 0) {
      itemsUl.innerHTML = '<li>Φόρτωση...</li>';
      
      const itemsSnapshot = await db.collection('lists')
        .doc(listId)
        .collection('items')
        .orderBy('name')
        .get();
      
      itemsUl.innerHTML = '';
      
      itemsSnapshot.forEach(doc => {
        const item = doc.data();
        const itemLi = document.createElement('li');
        
        itemLi.textContent = `${item.name}${item.quantity ? ` (${item.quantity})` : ''}${item.notes ? ` - ${item.notes}` : ''}`;
        
        if (item.status === 'completed') {
          itemLi.classList.add('completed-item');
        }
        
        itemsUl.appendChild(itemLi);
      });
    }
    
    // Show/hide items
    itemsUl.style.display = isOpen ? 'block' : 'none';
  }
  
  // ============================================================================
  // 9. EVENT LISTENERS
  // ============================================================================
  
  // --- Shopping Mode Toggle ---
  shoppingModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('shopping-mode', shoppingModeToggle.checked);
  });
  
  // --- Item Input Form ---
  addButton.addEventListener('click', addItemOrUpdateFavorite);
  itemNameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      addItemOrUpdateFavorite();
    }
  });
  
  // --- List Item Interactions ---
  shoppingListUl.addEventListener('click', handleListClick);
  completedListUl.addEventListener('click', handleListClick);
  lookLaterListUl.addEventListener('click', handleListClick);
  
  // --- Complete List ---
  completeListButton.addEventListener('click', completeCurrentList);
  
  // --- Category Tabs ---
  favoritesCategoryTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-tab')) {
      activeCategoryId = e.target.dataset.id;
      renderFavorites();
    }
  });
  
  // --- Favorite Buttons ---
  favoritesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('favorite-button')) {
      const favoriteId = e.target.dataset.id;
      const favoriteData = favoritesCache.find(fav => fav.id === favoriteId);
      
      if (favoriteData) {
        itemNameInput.value = favoriteData.name || '';
        itemQuantityInput.value = favoriteData.quantity || '';
        itemNotesInput.value = favoriteData.notes || '';
        itemNameInput.focus();
      }
    }
  });
  
  // --- Favorites Modal ---
  manageFavoritesButton.addEventListener('click', openFavoritesModal);
  closeModalButton.addEventListener('click', closeFavoritesModal);
  
  // Close modal when clicking overlay
  favoritesModalOverlay.addEventListener('click', (e) => {
    if (e.target === favoritesModalOverlay) {
      closeFavoritesModal();
    }
  });
  
  // --- Category Management ---
  addCategoryButton.addEventListener('click', addCategory);
  
  // Update favorite category
  modalFavoritesList.addEventListener('change', (e) => {
    if (e.target.classList.contains('modal-category-select')) {
      const favoriteId = e.target.dataset.id;
      const categoryId = e.target.value;
      
      db.collection('favorites').doc(favoriteId).update({
        categoryId: categoryId || null
      });
    }
  });
  
  // Edit/delete favorites in modal
  modalFavoritesList.addEventListener('click', (e) => {
    const target = e.target;
    const favoriteId = target.dataset.id;
    
    if (!favoriteId) return;
    
    // Edit favorite
    if (target.classList.contains('modal-edit-btn')) {
      const favoriteData = favoritesCache.find(fav => fav.id === favoriteId);
      
      if (favoriteData) {
        itemNameInput.value = favoriteData.name || '';
        itemQuantityInput.value = favoriteData.quantity || '';
        itemNotesInput.value = favoriteData.notes || '';
        editingFavoriteId = favoriteId;
        addButtonText.textContent = 'Ενημέρωση Αγαπημένου';
        saveFavoriteCheckbox.parentElement.style.display = 'none';
        closeFavoritesModal();
        itemNameInput.focus();
      }
    }
    
    // Delete favorite
    if (target.classList.contains('modal-delete-btn')) {
      const favoriteData = favoritesCache.find(fav => fav.id === favoriteId);
      
      if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το "${favoriteData.name}" από τα αγαπημένα;`)) {
        db.collection('favorites').doc(favoriteId).delete();
      }
    }
  });
  
  // --- Past Lists ---
  pastListsUl.addEventListener('click', handlePastListClick);
  
  // --- Authentication ---
  loginButton.addEventListener('click', () => {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  });
  
  // ============================================================================
  // 10. AUTHENTICATION STATE HANDLER
  // ============================================================================
  
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is signed in - check authorization
      const userDocRef = db.collection('allowedUsers').doc(user.uid);
      
      userDocRef.get().then((doc) => {
        if (doc.exists) {
          // --- AUTHORIZED USER ---
          document.body.classList.add('logged-in');
          userNameSpan.textContent = user.displayName;
          
          logoutButton.onclick = () => auth.signOut();
          
          // Load or create active list
          db.collection('lists')
            .where('isActive', '==', true)
            .limit(1)
            .get()
            .then(snapshot => {
              if (snapshot.empty) {
                createNewList();
              } else {
                loadList(snapshot.docs[0]);
              }
            });
          
          // Subscribe to past lists
          if (unsubscribeFromLists) {
            unsubscribeFromLists();
          }
          
          unsubscribeFromLists = db.collection('lists')
            .where('isActive', '==', false)
            .orderBy('completedAt', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
              pastListsUl.innerHTML = '';
              
              snapshot.forEach(doc => {
                const li = document.createElement('li');
                li.innerHTML = `
                  <div class="past-list-header" data-id="${doc.id}">
                    Λίστα της ${formatDate(doc.data().completedAt)}
                  </div>
                  <ul class="past-list-items"></ul>
                `;
                pastListsUl.appendChild(li);
              });
            });
          
          // Subscribe to categories
          if (unsubscribeFromCategories) {
            unsubscribeFromCategories();
          }
          
          unsubscribeFromCategories = db.collection('categories')
            .orderBy('name')
            .onSnapshot(snapshot => {
              categoriesCache = snapshot.docs.map(cat => ({
                id: cat.id,
                ...cat.data()
              }));
              renderFavorites();
            });
          
          // Subscribe to favorites
          if (unsubscribeFromFavorites) {
            unsubscribeFromFavorites();
          }
          
          unsubscribeFromFavorites = db.collection('favorites')
            .orderBy('name')
            .onSnapshot(snapshot => {
              favoritesCache = snapshot.docs.map(fav => ({
                id: fav.id,
                ...fav.data()
              }));
              renderFavorites();
              
              // Refresh modal if open
              if (favoritesModalOverlay.style.display === 'block') {
                openFavoritesModal();
              }
            });
          
        } else {
          // --- UNAUTHORIZED USER ---
          console.warn("Unauthorized user tried to log in:", user.displayName, user.uid);
          document.getElementById('login-section').style.display = 'none';
          document.getElementById('unauthorized-section').style.display = 'block';
          unauthorizedUserId.textContent = user.uid;
          unauthorizedLogoutButton.onclick = () => auth.signOut();
        }
      });
      
    } else {
      // --- USER SIGNED OUT ---
      
      // Reset UI state
      shoppingModeToggle.checked = false;
      document.body.classList.remove('shopping-mode');
      document.body.classList.remove('logged-in');
      document.getElementById('login-section').style.display = 'block';
      document.getElementById('unauthorized-section').style.display = 'none';
      
      // Unsubscribe from all listeners
      if (unsubscribeFromItems) unsubscribeFromItems();
      if (unsubscribeFromLists) unsubscribeFromLists();
      if (unsubscribeFromFavorites) unsubscribeFromFavorites();
      if (unsubscribeFromCategories) unsubscribeFromCategories();
      
      // Clear active list
      activeListId = null;
    }
  });
  
  // ============================================================================
  // 11. PROGRESSIVE WEB APP (PWA) SETUP
  // ============================================================================
  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully.'))
        .catch(err => console.log('Service Worker registration failed: ', err));
    });
  }