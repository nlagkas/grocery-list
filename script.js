/* =========================================================
   1. FIREBASE INITIALIZATION
   ========================================================= */

/**
 * Firebase project configuration
 */
const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.appspot.com",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
};

/* Initialize Firebase services */
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();


/* =========================================================
   2. DOM ELEMENT REFERENCES
   ========================================================= */

/* Authentication */
const loginButton               = document.getElementById('login-button');
const unauthorizedLogoutButton  = document.getElementById('unauthorized-logout-button');
const logoutButton              = document.getElementById('logout-button');
const userNameSpan              = document.getElementById('user-name');

/* Header & controls */
const listTitle                 = document.getElementById('list-title');
const shoppingModeToggle        = document.getElementById('shopping-mode-toggle');
const completeListButton        = document.getElementById('complete-list-button');

/* Add item form */
const itemNameInput             = document.getElementById('item-name-input');
const itemQuantityInput         = document.getElementById('item-quantity-input');
const itemNotesInput            = document.getElementById('item-notes-input');
const saveFavoriteCheckbox      = document.getElementById('save-favorite-checkbox');
const addButton                 = document.getElementById('add-button');
const addButtonText             = document.getElementById('add-button-text');

/* Lists */
const shoppingListUl            = document.getElementById('shopping-list-ul');
const completedListUl           = document.getElementById('completed-list-ul');
const lookLaterSection          = document.getElementById('look-later-section');
const lookLaterListUl           = document.getElementById('look-later-list-ul');
const pastListsUl               = document.getElementById('past-lists-ul');

/* Favorites */
const favoritesContainer        = document.getElementById('favorites-container');
const favoritesCategoryTabs     = document.getElementById('favorites-category-tabs');
const manageFavoritesButton     = document.getElementById('manage-favorites-button');

/* Favorites modal */
const favoritesModalOverlay     = document.getElementById('favorites-modal-overlay');
const closeModalButton          = document.getElementById('close-modal-button');
const modalFavoritesList        = document.getElementById('modal-favorites-list');
const newCategoryInput          = document.getElementById('new-category-input');
const addCategoryButton         = document.getElementById('add-category-button');


/* =========================================================
   3. GLOBAL STATE
   ========================================================= */

/* Active list state */
let activeListId = null;

/* Firestore unsubscribe handlers */
let unsubscribeFromItems      = null;
let unsubscribeFromLists      = null;
let unsubscribeFromFavorites  = null;
let unsubscribeFromCategories = null;

/* Cached data */
let favoritesCache   = [];
let categoriesCache  = [];

/* UI state */
let editingFavoriteId = null;
let activeCategoryId  = 'all';   // all | none | categoryId


/* =========================================================
   4. CORE HELPER FUNCTIONS
   ========================================================= */

/**
 * Formats Firestore timestamp to Greek locale date
 */
function formatDate(timestamp) {
    if (!timestamp) return '...';

    return new Date(timestamp.seconds * 1000).toLocaleDateString(
        "el-GR",
        { day: 'numeric', month: 'long', year: 'numeric' }
    );
}


/**
 * Loads a shopping list and listens for its items
 */
function loadList(listDoc) {
    activeListId = listDoc.id;
    listTitle.textContent = `Λίστα: ${formatDate(listDoc.data().createdAt)}`;

    if (unsubscribeFromItems) unsubscribeFromItems();

    const itemsRef = db.collection('lists')
                       .doc(activeListId)
                       .collection('items');

    unsubscribeFromItems = itemsRef
        .orderBy('name')
        .onSnapshot(snapshot => {

            shoppingListUl.innerHTML = '';
            completedListUl.innerHTML = '';
            lookLaterListUl.innerHTML = '';

            snapshot.forEach(doc => {
                const item = doc.data();
                const id   = doc.id;

                const li = document.createElement('li');
                li.innerHTML = `
                    <input type="checkbox"
                           class="item-checkbox"
                           data-id="${id}"
                           ${item.status === 'completed' ? 'checked' : ''}>

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

                if (item.status === 'completed') {
                    completedListUl.appendChild(li);
                } else if (item.status === 'later') {
                    lookLaterListUl.appendChild(li);
                } else {
                    shoppingListUl.appendChild(li);
                }
            });

            lookLaterSection.classList.toggle(
                'empty',
                lookLaterListUl.children.length === 0
            );
        });
}


/**
 * Creates a new active shopping list
 */
async function createNewList() {
    shoppingListUl.innerHTML = '<li>Δημιουργία νέας λίστας...</li>';
    completedListUl.innerHTML = '';

    const newListRef = await db.collection('lists').add({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        completedAt: null
    });

    loadList(await newListRef.get());
}


/**
 * Resets the add-item form UI
 */
function resetAddItemForm() {
    itemNameInput.value     = '';
    itemQuantityInput.value = '';
    itemNotesInput.value    = '';

    saveFavoriteCheckbox.checked = false;
    editingFavoriteId = null;

    addButtonText.textContent = 'Προσθήκη στη Λίστα';
    saveFavoriteCheckbox.parentElement.style.display = 'flex';

    itemNameInput.focus();
}


/* =========================================================
   5. FAVORITES RENDERING
   ========================================================= */

/**
 * Renders category tabs and filtered favorite buttons
 */
function renderFavorites() {

    /* ----- Category Tabs ----- */
    favoritesCategoryTabs.innerHTML = '';

    const createTab = (label, id) => {
        const tab = document.createElement('button');
        tab.className = 'category-tab';
        tab.textContent = label;
        tab.dataset.id = id;
        if (id === activeCategoryId) tab.classList.add('active');
        favoritesCategoryTabs.appendChild(tab);
    };

    createTab('Όλα', 'all');
    createTab('Χωρίς Κατηγορία', 'none');

    categoriesCache.forEach(cat => {
        createTab(cat.name, cat.id);
    });

    /* ----- Favorite Buttons ----- */
    favoritesContainer.innerHTML = '';

    favoritesCache
        .filter(fav => {
            if (activeCategoryId === 'all') return true;
            if (activeCategoryId === 'none') return !fav.categoryId;
            return fav.categoryId === activeCategoryId;
        })
        .forEach(fav => {
            const button = document.createElement('button');
            button.className = 'favorite-button';
            button.textContent = fav.name;
            button.dataset.id = fav.id;
            favoritesContainer.appendChild(button);
        });
}


/* =========================================================
   6. FAVORITES MODAL
   ========================================================= */

function openFavoritesModal() {
    modalFavoritesList.innerHTML = '';

    favoritesCache.forEach(fav => {
        let optionsHtml = `<option value="">-- Επιλογή --</option>`;

        categoriesCache.forEach(cat => {
            optionsHtml += `
                <option value="${cat.id}"
                    ${fav.categoryId === cat.id ? 'selected' : ''}>
                    ${cat.name}
                </option>`;
        });

        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-content">${fav.name}</span>
            <div class="item-actions">
                <select class="modal-category-select"
                        data-id="${fav.id}">
                    ${optionsHtml}
                </select>
                <div class="modal-actions">
                    <button class="modal-edit-btn" data-id="${fav.id}">
                        Επεξεργασία
                    </button>
                    <button class="modal-delete-btn" data-id="${fav.id}">
                        Διαγραφή
                    </button>
                </div>
            </div>
        `;

        modalFavoritesList.appendChild(li);
    });

    favoritesModalOverlay.style.display = 'block';
}

function closeFavoritesModal() {
    favoritesModalOverlay.style.display = 'none';
    if (editingFavoriteId) resetAddItemForm();
}


/* =========================================================
   7. ITEM & FAVORITE CREATION
   ========================================================= */

function addItemOrUpdateFavorite() {
    const name = itemNameInput.value.trim();
    if (!name) return;

    const quantity = itemQuantityInput.value.trim();
    const notes    = itemNotesInput.value.trim();

    /* Update existing favorite */
    if (editingFavoriteId) {
        db.collection('favorites')
          .doc(editingFavoriteId)
          .set({ name, quantity, notes })
          .then(resetAddItemForm);
        return;
    }

    /* Add item to list */
    if (activeListId) {
        db.collection('lists')
          .doc(activeListId)
          .collection('items')
          .add({ name, quantity, notes, status: 'pending' });
    }

    /* Save as favorite */
    if (saveFavoriteCheckbox.checked) {
        const favoriteId = name.toLowerCase();
        db.collection('favorites')
          .doc(favoriteId)
          .set({ name, quantity, notes, categoryId: null }, { merge: true });
    }

    resetAddItemForm();
}


/* =========================================================
   8. EVENT HANDLERS
   ========================================================= */

/* Category tabs */
favoritesCategoryTabs.addEventListener('click', e => {
    if (!e.target.classList.contains('category-tab')) return;
    activeCategoryId = e.target.dataset.id;
    renderFavorites();
});

/* Shopping mode */
shoppingModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('shopping-mode', shoppingModeToggle.checked);
});

/* Add item */
addButton.addEventListener('click', addItemOrUpdateFavorite);
itemNameInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') addItemOrUpdateFavorite();
});

/* Favorites modal */
manageFavoritesButton.addEventListener('click', openFavoritesModal);
closeModalButton.addEventListener('click', closeFavoritesModal);

favoritesModalOverlay.addEventListener('click', e => {
    if (e.target === favoritesModalOverlay) closeFavoritesModal();
});

/* Login */
loginButton.addEventListener('click', () =>
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
);


/* =========================================================
   9. AUTH CONTROLLER
   ========================================================= */

auth.onAuthStateChanged(user => {
    if (!user) {
        document.body.classList.remove('logged-in', 'shopping-mode');
        shoppingModeToggle.checked = false;

        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        if (unsubscribeFromFavorites) unsubscribeFromFavorites();
        if (unsubscribeFromCategories) unsubscribeFromCategories();

        activeListId = null;
        return;
    }

    const userDocRef = db.collection('allowedUsers').doc(user.uid);

    userDocRef.get().then(doc => {
        if (!doc.exists) {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('unauthorized-section').style.display = 'block';
            unauthorizedLogoutButton.onclick = () => auth.signOut();
            return;
        }

        document.body.classList.add('logged-in');
        userNameSpan.textContent = user.displayName;
        logoutButton.onclick = () => auth.signOut();

        db.collection('lists')
          .where('isActive', '==', true)
          .limit(1)
          .get()
          .then(snapshot =>
              snapshot.empty ? createNewList() : loadList(snapshot.docs[0])
          );

        unsubscribeFromCategories = db.collection('categories')
            .orderBy('name')
            .onSnapshot(s => {
                categoriesCache = s.docs.map(d => ({ id: d.id, ...d.data() }));
                renderFavorites();
            });

        unsubscribeFromFavorites = db.collection('favorites')
            .orderBy('name')
            .onSnapshot(s => {
                favoritesCache = s.docs.map(d => ({ id: d.id, ...d.data() }));
                renderFavorites();
                if (favoritesModalOverlay.style.display === 'block') {
                    openFavoritesModal();
                }
            });
    });
});


/* =========================================================
   10. SERVICE WORKER
   ========================================================= */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.js')
            .then(() => console.log('SW registered'))
            .catch(err => console.log('SW failed:', err));
    });
}
