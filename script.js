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
const itemNameInput = document.getElementById('item-name-input');
const itemQuantityInput = document.getElementById('item-quantity-input');
const itemNotesInput = document.getElementById('item-notes-input');
const saveFavoriteCheckbox = document.getElementById('save-favorite-checkbox');
const addButton = document.getElementById('add-button');
const completeListButton = document.getElementById('complete-list-button');
const shoppingListUl = document.getElementById('shopping-list-ul');
const completedListUl = document.getElementById('completed-list-ul');
const pastListsUl = document.getElementById('past-lists-ul');
const favoritesContainer = document.getElementById('favorites-container');

// --- 3. GLOBAL STATE ---
let activeListId = null;
let unsubscribeFromItems = null;
let unsubscribeFromLists = null;
let unsubscribeFromFavorites = null;
let favoritesCache = []; // Cache to hold favorite item data

// --- 4. CORE FUNCTIONS ---
function formatDate(timestamp) { /* ... same as before ... */ }
function loadList(listDoc) { /* ... same as before ... */ }
async function createNewList() { /* ... same as before ... */ }

/**
 * Reads data from the form and adds a new item to the active list.
 * Also saves the item as a favorite if the checkbox is checked.
 */
function addItem() {
    const itemName = itemNameInput.value.trim();
    const itemQuantity = itemQuantityInput.value.trim();
    const itemNotes = itemNotesInput.value.trim();
    const saveAsFavorite = saveFavoriteCheckbox.checked;

    if (!itemName || !activeListId) return;

    // Add to the current shopping list
    db.collection('lists').doc(activeListId).collection('items').add({
        name: itemName,
        quantity: itemQuantity,
        notes: itemNotes,
        completed: false
    });
    
    // Save to favorites if checked
    if (saveAsFavorite) {
        // Use the item name as a unique ID to prevent duplicates.
        // We convert to lowercase to make it case-insensitive.
        const favoriteId = itemName.toLowerCase();
        db.collection('favorites').doc(favoriteId).set({
            name: itemName,
            quantity: itemQuantity,
            notes: itemNotes,
        }, { merge: true }); // 'merge: true' updates if it exists, creates if not
    }

    // Clear form fields
    itemNameInput.value = '';
    itemQuantityInput.value = '';
    itemNotesInput.value = '';
    saveFavoriteCheckbox.checked = false;
    itemNameInput.focus();
}

/**
 * Handles clicks within the active lists for checkboxes and delete buttons.
 * @param {Event} e The click event.
 */
function handleListClick(e) { /* ... same as before ... */ }


// --- 5. EVENT LISTENERS SETUP ---
addButton.addEventListener('click', addItem);
itemNameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') addItem(); });
completeListButton.addEventListener('click', async () => { /* ... same as before ... */ });
shoppingListUl.addEventListener('click', handleListClick);
completedListUl.addEventListener('click', handleListClick);
pastListsUl.addEventListener('click', async (e) => { /* ... same as before ... */ });
loginButton.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));

// NEW: Event listener for clicking on favorite buttons
favoritesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('favorite-button')) {
        const favoriteId = e.target.dataset.id;
        const favoriteData = favoritesCache.find(fav => fav.id === favoriteId);
        if (favoriteData) {
            // Pre-fill the form with the favorite's data
            itemNameInput.value = favoriteData.name || '';
            itemQuantityInput.value = favoriteData.quantity || '';
            itemNotesInput.value = favoriteData.notes || '';
            itemNameInput.focus();
        }
    }
});


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
                    .onSnapshot(snapshot => { /* ... same list rendering ... */ });

                // NEW: Listen for changes to favorites
                if (unsubscribeFromFavorites) unsubscribeFromFavorites();
                unsubscribeFromFavorites = db.collection('favorites').orderBy('name').onSnapshot(snapshot => {
                    favoritesContainer.innerHTML = '';
                    favoritesCache = [];
                    snapshot.docs.forEach(doc => {
                        const favorite = doc.data();
                        const id = doc.id;
                        favoritesCache.push({ id, ...favorite });

                        const button = document.createElement('button');
                        button.className = 'favorite-button';
                        button.textContent = favorite.name;
                        button.dataset.id = id;
                        favoritesContainer.appendChild(button);
                    });
                });

            } else { // User is NOT AUTHORIZED
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('unauthorized-section').style.display = 'block';
                unauthorizedLogoutButton.onclick = () => auth.signOut();
            }
        });
    } else {
        // User is LOGGED OUT
        document.body.classList.remove('logged-in');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('unauthorized-section').style.display = 'none';
        
        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        if (unsubscribeFromFavorites) unsubscribeFromFavorites();
        activeListId = null;
    }
});

// --- PASTE THE UNCHANGED HELPER FUNCTIONS HERE ---
function formatDate(timestamp) {
    if (!timestamp) return '...';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("el-GR", { day: 'numeric', month: 'long', year: 'numeric' });
}

function loadList(listDoc) {
    activeListId = listDoc.id;
    const listData = listDoc.data();
    listTitle.textContent = `Λίστα: ${formatDate(listData.createdAt)}`;
    if (unsubscribeFromItems) unsubscribeFromItems();
    const itemsRef = db.collection('lists').doc(activeListId).collection('items');
    unsubscribeFromItems = itemsRef.orderBy('name').onSnapshot(snapshot => {
        shoppingListUl.innerHTML = '';
        completedListUl.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const item = doc.data();
            const id = doc.id;
            const li = document.createElement('li');
            li.innerHTML = `<input type="checkbox" class="item-checkbox" data-id="${id}" ${item.completed ? 'checked' : ''}><div class="item-content"><div class="item-name">${item.name}</div><div class="item-details">${item.quantity ? `<span class="quantity">${item.quantity}</span>` : ''}${item.notes ? `<span class="notes">${item.notes}</span>` : ''}</div></div><button class="delete-button" data-id="${id}">&times;</button>`;
            item.completed ? completedListUl.appendChild(li) : shoppingListUl.appendChild(li);
        });
    });
}

async function createNewList() {
    console.log("Creating a new list...");
    shoppingListUl.innerHTML = '<li>Δημιουργία νέας λίστας...</li>';
    completedListUl.innerHTML = '';
    const newList = { createdAt: firebase.firestore.FieldValue.serverTimestamp(), isActive: true, completedAt: null };
    const newListRef = await db.collection('lists').add(newList);
    const newListDoc = await newListRef.get();
    loadList(newListDoc);
}

function handleListClick(e) {
    const target = e.target;
    if (!activeListId) return;
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

// Re-pasting the main auth controller to ensure all new listeners are included
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
                        snapshot.docs.forEach(doc => {
                            const list = doc.data();
                            const listId = doc.id;
                            const li = document.createElement('li');
                            li.innerHTML = `<div class="past-list-header" data-id="${listId}">Λίστα της ${formatDate(list.completedAt)}</div><ul class="past-list-items"></ul>`;
                            pastListsUl.appendChild(li);
                        });
                    });

                // Listen for changes to favorites
                if (unsubscribeFromFavorites) unsubscribeFromFavorites();
                unsubscribeFromFavorites = db.collection('favorites').orderBy('name').onSnapshot(snapshot => {
                    favoritesContainer.innerHTML = '';
                    favoritesCache = [];
                    snapshot.docs.forEach(doc => {
                        const favorite = doc.data();
                        const id = doc.id;
                        favoritesCache.push({ id, ...favorite });

                        const button = document.createElement('button');
                        button.className = 'favorite-button';
                        button.textContent = favorite.name;
                        button.dataset.id = id;
                        favoritesContainer.appendChild(button);
                    });
                });

            } else { // User is NOT AUTHORIZED
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('unauthorized-section').style.display = 'block';
                unauthorizedLogoutButton.onclick = () => auth.signOut();
            }
        });
    } else {
        // User is LOGGED OUT
        document.body.classList.remove('logged-in');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('unauthorized-section').style.display = 'none';
        
        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        if (unsubscribeFromFavorites) unsubscribeFromFavorites();
        activeListId = null;
    }
});