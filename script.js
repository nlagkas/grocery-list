// --- 1. FIREBASE INITIALIZATION ---
// This section configures and initializes the connection to your Firebase project.
const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.appspot.com",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. DOM ELEMENT REFERENCES ---
// Storing all HTML element references in constants for easy access and performance.
const loginButton = document.getElementById('login-button');
const unauthorizedLogoutButton = document.getElementById('unauthorized-logout-button');
const logoutButton = document.getElementById('logout-button');
const userNameSpan = document.getElementById('user-name');
const listTitle = document.getElementById('list-title');
const itemNameInput = document.getElementById('item-name-input');
const itemQuantityInput = document.getElementById('item-quantity-input');
const itemNotesInput = document.getElementById('item-notes-input');
const saveFavoriteCheckbox = document.getElementById('save-favorite-checkbox');
const addButton = document.getElementById('add-button');
const addButtonText = document.getElementById('add-button-text');
const completeListButton = document.getElementById('complete-list-button');
const shoppingListUl = document.getElementById('shopping-list-ul');
const completedListUl = document.getElementById('completed-list-ul');
const pastListsUl = document.getElementById('past-lists-ul');
const favoritesContainer = document.getElementById('favorites-container');
const manageFavoritesButton = document.getElementById('manage-favorites-button');
const favoritesModalOverlay = document.getElementById('favorites-modal-overlay');
const closeModalButton = document.getElementById('close-modal-button');
const modalFavoritesList = document.getElementById('modal-favorites-list');

// --- 3. GLOBAL STATE MANAGEMENT ---
// Variables that hold the application's state.
let activeListId = null;
let unsubscribeFromItems = null;
let unsubscribeFromLists = null;
let unsubscribeFromFavorites = null;
let favoritesCache = []; // Local cache for favorite items to speed up UI operations.
let editingFavoriteId = null; // A flag to know if the form is in "edit" mode.

// --- 4. CORE LOGIC FUNCTIONS ---

/**
 * Formats a Firestore timestamp into a readable Greek date string.
 * @param {firebase.firestore.Timestamp} timestamp The timestamp to format.
 * @returns {string} The formatted date string (e.g., "5 Μαΐου 2024").
 */
function formatDate(timestamp) {
    if (!timestamp) return '...';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("el-GR", {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

/**
 * Renders the active shopping list and its items, and attaches a real-time listener.
 * @param {firebase.firestore.DocumentSnapshot} listDoc The document snapshot of the list to load.
 */
function loadList(listDoc) {
    activeListId = listDoc.id;
    const listData = listDoc.data();
    listTitle.textContent = `Λίστα: ${formatDate(listData.createdAt)}`;

    if (unsubscribeFromItems) unsubscribeFromItems();

    const itemsRef = db.collection('lists').doc(activeListId).collection('items');
    
    unsubscribeFromItems = itemsRef.orderBy('name').onSnapshot(snapshot => {
        shoppingListUl.innerHTML = '';
        completedListUl.innerHTML = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const id = doc.id;
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" class="item-checkbox" data-id="${id}" ${item.completed ? 'checked' : ''}>
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">
                        ${item.quantity ? `<span class="quantity">${item.quantity}</span>` : ''}
                        ${item.notes ? `<span class="notes">${item.notes}</span>` : ''}
                    </div>
                </div>
                <button class="delete-button" data-id="${id}">&times;</button>
            `;
            item.completed ? completedListUl.appendChild(li) : shoppingListUl.appendChild(li);
        });
    });
}

/**
 * Creates a new, empty, active shopping list document in Firestore.
 */
async function createNewList() {
    console.log("Creating a new list...");
    shoppingListUl.innerHTML = '<li>Δημιουργία νέας λίστας...</li>';
    completedListUl.innerHTML = '';

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
 * Resets the "Add Item" form to its default, empty state.
 */
function resetAddItemForm() {
    itemNameInput.value = '';
    itemQuantityInput.value = '';
    itemNotesInput.value = '';
    saveFavoriteCheckbox.checked = false;
    editingFavoriteId = null; // Clear the editing flag
    addButtonText.textContent = 'Προσθήκη στη Λίστα';
    saveFavoriteCheckbox.parentElement.style.display = 'flex'; // Show the checkbox again
    itemNameInput.focus();
}

/**
 * Handles the logic for the main form button. It either adds a new item to the
 * list or updates an existing favorite, depending on the `editingFavoriteId` state.
 */
function addItemOrUpdateFavorite() {
    const itemName = itemNameInput.value.trim();
    if (!itemName) return; // Item name is required.

    const itemQuantity = itemQuantityInput.value.trim();
    const itemNotes = itemNotesInput.value.trim();

    // If editingFavoriteId has a value, we are in "update" mode.
    if (editingFavoriteId) {
        db.collection('favorites').doc(editingFavoriteId).set({
            name: itemName,
            quantity: itemQuantity,
            notes: itemNotes,
        }).then(() => {
            console.log("Favorite updated successfully:", editingFavoriteId);
            resetAddItemForm();
        });
        return; // Stop here after updating.
    }

    // Otherwise, we are in "add new item" mode.
    if (activeListId) {
        db.collection('lists').doc(activeListId).collection('items').add({
            name: itemName, quantity: itemQuantity, notes: itemNotes, completed: false
        });
    }
    
    if (saveFavoriteCheckbox.checked) {
        const favoriteId = itemName.toLowerCase();
        db.collection('favorites').doc(favoriteId).set({
            name: itemName, quantity: itemQuantity, notes: itemNotes,
        }, { merge: true }); // Use merge to avoid overwriting accidentally.
    }

    resetAddItemForm();
}

/**
 * Populates the favorites management modal with the latest data and makes it visible.
 */
function openFavoritesModal() {
    modalFavoritesList.innerHTML = ''; // Clear previous list
    favoritesCache.forEach(fav => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-content">${fav.name}</span>
            <div class="modal-actions">
                <button class="modal-edit-btn" data-id="${fav.id}">Επεξεργασία</button>
                <button class="modal-delete-btn" data-id="${fav.id}">Διαγραφή</button>
            </div>
        `;
        modalFavoritesList.appendChild(li);
    });
    favoritesModalOverlay.style.display = 'block';
}

/**
 * Hides the favorites management modal.
 */
function closeFavoritesModal() {
    favoritesModalOverlay.style.display = 'none';
    if (editingFavoriteId) {
        resetAddItemForm(); // If user closes modal while editing, reset the form.
    }
}

/**
 * Handles clicks within the active lists using event delegation for checkboxes and deletes.
 * @param {Event} e The click event.
 */
function handleListClick(e) {
    const target = e.target;
    if (!activeListId || !target.dataset.id) return;

    const itemsRef = db.collection('lists').doc(activeListId).collection('items');
    const id = target.dataset.id;

    if (target.classList.contains('item-checkbox')) {
        itemsRef.doc(id).update({ completed: target.checked });
    }

    if (target.classList.contains('delete-button')) {
        if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το προϊόν;`)) {
            itemsRef.doc(id).delete();
        }
    }
}


// --- 5. EVENT LISTENERS SETUP ---
// This section connects user actions (clicks, key presses) to our logic functions.

// Form and list actions
addButton.addEventListener('click', addItemOrUpdateFavorite);
itemNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') addItemOrUpdateFavorite(); });
shoppingListUl.addEventListener('click', handleListClick);
completedListUl.addEventListener('click', handleListClick);

// Main app controls
completeListButton.addEventListener('click', async () => {
    if (!activeListId || !confirm('Είστε σίγουροι ότι θέλετε να ολοκληρώσετε αυτή τη λίστα;')) return;
    
    const currentListRef = db.collection('lists').doc(activeListId);
    await currentListRef.update({ isActive: false, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
    
    if (unsubscribeFromItems) unsubscribeFromItems();
    activeListId = null;
    shoppingListUl.innerHTML = '';
    completedListUl.innerHTML = '';
    
    await createNewList();
});

// Favorites quick-add and management
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
manageFavoritesButton.addEventListener('click', openFavoritesModal);
closeModalButton.addEventListener('click', closeFavoritesModal);
favoritesModalOverlay.addEventListener('click', (e) => { if (e.target === favoritesModalOverlay) closeFavoritesModal(); });

// Modal action listeners (Edit/Delete)
modalFavoritesList.addEventListener('click', (e) => {
    const target = e.target;
    const favoriteId = target.dataset.id;
    if (!favoriteId) return;

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

    if (target.classList.contains('modal-delete-btn')) {
        const favoriteData = favoritesCache.find(fav => fav.id === favoriteId);
        if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το "${favoriteData.name}" από τα αγαπημένα;`)) {
            db.collection('favorites').doc(favoriteId).delete();
        }
    }
});

// Past lists viewer
pastListsUl.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('past-list-header')) return;
    const header = e.target;
    const listId = header.dataset.id;
    const itemsUl = header.nextElementSibling;
    header.classList.toggle('open');
    const isOpen = header.classList.contains('open');
    if (isOpen && itemsUl.children.length === 0) {
        itemsUl.innerHTML = '<li>Φόρτωση...</li>';
        const itemsSnapshot = await db.collection('lists').doc(listId).collection('items').orderBy('name').get();
        itemsUl.innerHTML = '';
        itemsSnapshot.forEach(doc => {
            const item = doc.data();
            const itemLi = document.createElement('li');
            itemLi.textContent = `${item.name}${item.quantity ? ` (${item.quantity})` : ''}${item.notes ? ` - ${item.notes}` : ''}`;
            if (item.completed) { itemLi.style.textDecoration = 'line-through'; itemLi.style.color = '#888'; }
            itemsUl.appendChild(itemLi);
        });
    }
    itemsUl.style.display = isOpen ? 'block' : 'none';
});

// Login button
loginButton.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));


// --- 6. MAIN AUTHENTICATION CONTROLLER ---
// This is the entry point of the application. It runs when the user's login state changes.
auth.onAuthStateChanged(user => {
    if (user) {
        const userDocRef = db.collection('allowedUsers').doc(user.uid);
        userDocRef.get().then((doc) => {
            if (doc.exists) {
                // --- User is AUTHORIZED ---
                document.body.classList.add('logged-in');
                userNameSpan.textContent = user.displayName;
                logoutButton.onclick = () => auth.signOut();
                
                // Find active list or create one if none exists
                db.collection('lists').where('isActive', '==', true).limit(1).get().then(snapshot => {
                    snapshot.empty ? createNewList() : loadList(snapshot.docs[0]);
                });

                // Listen for past lists
                if (unsubscribeFromLists) unsubscribeFromLists();
                unsubscribeFromLists = db.collection('lists').where('isActive', '==', false).orderBy('completedAt', 'desc').limit(10)
                    .onSnapshot(snapshot => {
                        pastListsUl.innerHTML = '';
                        snapshot.forEach(doc => {
                            const li = document.createElement('li');
                            li.innerHTML = `<div class="past-list-header" data-id="${doc.id}">Λίστα της ${formatDate(doc.data().completedAt)}</div><ul class="past-list-items"></ul>`;
                            pastListsUl.appendChild(li);
                        });
                    });

                // Listen for favorites and update the UI
                if (unsubscribeFromFavorites) unsubscribeFromFavorites();
                unsubscribeFromFavorites = db.collection('favorites').orderBy('name').onSnapshot(snapshot => {
                    favoritesContainer.innerHTML = '';
                    favoritesCache = [];
                    snapshot.forEach(doc => {
                        favoritesCache.push({ id: doc.id, ...doc.data() });
                        const button = document.createElement('button');
                        button.className = 'favorite-button';
                        button.textContent = doc.data().name;
                        button.dataset.id = doc.id;
                        favoritesContainer.appendChild(button);
                    });
                    
                    // If the modal is open, refresh its content to reflect any changes.
                    if (favoritesModalOverlay.style.display === 'block') {
                        openFavoritesModal();
                    }
                });

            } else {
                // --- User is NOT AUTHORIZED ---
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('unauthorized-section').style.display = 'block';
                unauthorizedLogoutButton.onclick = () => auth.signOut();
            }
        });
    } else {
        // --- User is LOGGED OUT ---
        document.body.classList.remove('logged-in');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('unauthorized-section').style.display = 'none';
        
        // Unsubscribe from all real-time listeners to prevent errors and resource leaks.
        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        if (unsubscribeFromFavorites) unsubscribeFromFavorites();
        activeListId = null;
    }
});