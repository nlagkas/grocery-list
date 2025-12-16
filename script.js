// --- 1. FIREBASE INITIALIZATION ---
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
const loginButton = document.getElementById('login-button');
const unauthorizedLogoutButton = document.getElementById('unauthorized-logout-button');
const logoutButton = document.getElementById('logout-button');
const userNameSpan = document.getElementById('user-name');
const listTitle = document.getElementById('list-title');
const shoppingModeToggle = document.getElementById('shopping-mode-toggle');
const itemNameInput = document.getElementById('item-name-input');
const itemQuantityInput = document.getElementById('item-quantity-input');
const itemNotesInput = document.getElementById('item-notes-input');
const saveFavoriteCheckbox = document.getElementById('save-favorite-checkbox');
const addButton = document.getElementById('add-button');
const addButtonText = document.getElementById('add-button-text');
const completeListButton = document.getElementById('complete-list-button');
const shoppingListUl = document.getElementById('shopping-list-ul');
const completedListUl = document.getElementById('completed-list-ul');
const lookLaterSection = document.getElementById('look-later-section');
const lookLaterListUl = document.getElementById('look-later-list-ul');
const pastListsUl = document.getElementById('past-lists-ul');
const favoritesContainer = document.getElementById('favorites-container');
const manageFavoritesButton = document.getElementById('manage-favorites-button');
const favoritesModalOverlay = document.getElementById('favorites-modal-overlay');
const closeModalButton = document.getElementById('close-modal-button');
const modalFavoritesList = document.getElementById('modal-favorites-list');

// --- 3. GLOBAL STATE MANAGEMENT ---
let activeListId = null;
let unsubscribeFromItems = null;
let unsubscribeFromLists = null;
let unsubscribeFromFavorites = null;
let favoritesCache = [];
let editingFavoriteId = null;

// --- 4. CORE LOGIC FUNCTIONS ---

/**
 * Formats a Firestore timestamp into a readable Greek date string.
 * @param {firebase.firestore.Timestamp} timestamp The timestamp to format.
 * @returns {string} The formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return '...';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("el-GR", {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

/**
 * Renders the active shopping list, sorting items into three status-based lists.
 * @param {firebase.firestore.DocumentSnapshot} listDoc The document snapshot of the list to load.
 */
function loadList(listDoc) {
    activeListId = listDoc.id;
    listTitle.textContent = `Λίστα: ${formatDate(listDoc.data().createdAt)}`;

    if (unsubscribeFromItems) unsubscribeFromItems();
    const itemsRef = db.collection('lists').doc(activeListId).collection('items');
    
    unsubscribeFromItems = itemsRef.orderBy('name').onSnapshot(snapshot => {
        shoppingListUl.innerHTML = '';
        completedListUl.innerHTML = '';
        lookLaterListUl.innerHTML = ''; // Clear the new list

        snapshot.forEach(doc => {
            const item = doc.data();
            const id = doc.id;
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" class="item-checkbox" data-id="${id}" ${item.status === 'completed' ? 'checked' : ''}>
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">
                        ${item.quantity ? `<span class="quantity">${item.quantity}</span>` : ''}
                        ${item.notes ? `<span class="notes">${item.notes}</span>` : ''}
                    </div>
                </div>
                <button class="cant-find-button" data-id="${id}">?</button>
                <button class="delete-button" data-id="${id}">&times;</button>
            `;
            
            // Sort item into the correct list based on its status
            if (item.status === 'completed') {
                completedListUl.appendChild(li);
            } else if (item.status === 'later') {
                lookLaterListUl.appendChild(li);
            } else { // Default to 'pending'
                shoppingListUl.appendChild(li);
            }
        });

        // Toggle visibility of the "Look Later" section based on whether it has items
        lookLaterSection.classList.toggle('empty', lookLaterListUl.children.length === 0);
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
    editingFavoriteId = null;
    addButtonText.textContent = 'Προσθήκη στη Λίστα';
    saveFavoriteCheckbox.parentElement.style.display = 'flex';
    itemNameInput.focus();
}

/**
 * Handles the logic for the main form button, adding or updating items.
 */
function addItemOrUpdateFavorite() {
    const itemName = itemNameInput.value.trim();
    if (!itemName) return;

    const itemQuantity = itemQuantityInput.value.trim();
    const itemNotes = itemNotesInput.value.trim();

    if (editingFavoriteId) {
        db.collection('favorites').doc(editingFavoriteId).set({
            name: itemName, quantity: itemQuantity, notes: itemNotes,
        }).then(() => {
            console.log("Favorite updated successfully");
            resetAddItemForm();
        });
        return;
    }

    if (activeListId) {
        db.collection('lists').doc(activeListId).collection('items').add({
            name: itemName, quantity: itemQuantity, notes: itemNotes,
            status: 'pending' // Set default status for new items
        });
    }
    
    if (saveFavoriteCheckbox.checked) {
        const favoriteId = itemName.toLowerCase();
        db.collection('favorites').doc(favoriteId).set({
            name: itemName, quantity: itemQuantity, notes: itemNotes,
        }, { merge: true });
    }
    resetAddItemForm();
}

/**
 * Populates and opens the favorites management modal.
 */
function openFavoritesModal() {
    modalFavoritesList.innerHTML = '';
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
        resetAddItemForm();
    }
}

/**
 * Handles clicks within ALL active lists (To Buy, Look Later, Completed) using event delegation.
 * @param {Event} e The click event.
 */
function handleListClick(e) {
    const target = e.target;
    if (!activeListId || !target.dataset.id) return;

    const itemsRef = db.collection('lists').doc(activeListId).collection('items');
    const id = target.dataset.id;

    if (target.classList.contains('item-checkbox')) {
        const newStatus = target.checked ? 'completed' : 'pending';
        itemsRef.doc(id).update({ status: newStatus });
    }

    if (target.classList.contains('delete-button')) {
        if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το προϊόν;`)) {
            itemsRef.doc(id).delete();
        }
    }

    if (target.classList.contains('cant-find-button')) {
        itemsRef.doc(id).update({ status: 'later' });
    }
}


// --- 5. EVENT LISTENERS SETUP ---
shoppingModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('shopping-mode', shoppingModeToggle.checked);
});

addButton.addEventListener('click', addItemOrUpdateFavorite);
itemNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') addItemOrUpdateFavorite(); });

shoppingListUl.addEventListener('click', handleListClick);
completedListUl.addEventListener('click', handleListClick);
lookLaterListUl.addEventListener('click', handleListClick); // Add listener to the new list

completeListButton.addEventListener('click', async () => {
    if (!activeListId || !confirm('Είστε σίγουροι ότι θέλετε να ολοκληρώσετε αυτή τη λίστα;')) return;
    const currentListRef = db.collection('lists').doc(activeListId);
    await currentListRef.update({ isActive: false, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
    if (unsubscribeFromItems) unsubscribeFromItems();
    activeListId = null;
    shoppingListUl.innerHTML = '';
    completedListUl.innerHTML = '';
    lookLaterListUl.innerHTML = ''; // Clear this list too
    await createNewList();
});

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
            if (item.status === 'completed') { itemLi.classList.add('completed-item'); }
            itemsUl.appendChild(itemLi);
        });
    }
    itemsUl.style.display = isOpen ? 'block' : 'none';
});

loginButton.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));


// --- 6. MAIN AUTHENTICATION CONTROLLER ---
auth.onAuthStateChanged(user => {
    if (user) {
        const userDocRef = db.collection('allowedUsers').doc(user.uid);
        userDocRef.get().then((doc) => {
            if (doc.exists) {
                // User is AUTHORIZED
                document.body.classList.add('logged-in');
                userNameSpan.textContent = user.displayName;
                logoutButton.onclick = () => auth.signOut();
                
                db.collection('lists').where('isActive', '==', true).limit(1).get().then(snapshot => {
                    snapshot.empty ? createNewList() : loadList(snapshot.docs[0]);
                });

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
                    if (favoritesModalOverlay.style.display === 'block') { openFavoritesModal(); }
                });

            } else {
                // User is NOT AUTHORIZED
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('unauthorized-section').style.display = 'block';
                unauthorizedLogoutButton.onclick = () => auth.signOut();
            }
        });
    } else {
        // User is LOGGED OUT
        shoppingModeToggle.checked = false;
        document.body.classList.remove('shopping-mode');
        document.body.classList.remove('logged-in');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('unauthorized-section').style.display = 'none';
        
        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        if (unsubscribeFromFavorites) unsubscribeFromFavorites();
        activeListId = null;
    }
});


// --- 7. PWA SERVICE WORKER REGISTRATION ---
// This is the new code that activates your PWA features.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}