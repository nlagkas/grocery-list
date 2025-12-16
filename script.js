// --- 1. INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.firebasestorage.app",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
  };
  


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. GET HTML ELEMENTS ---
const loginButton = document.getElementById('login-button');
const unauthorizedLogoutButton = document.getElementById('unauthorized-logout-button');
const logoutButton = document.getElementById('logout-button');
const userNameSpan = document.getElementById('user-name');
const listTitle = document.getElementById('list-title');
const itemInput = document.getElementById('item-input');
const addButton = document.getElementById('add-button');
const completeListButton = document.getElementById('complete-list-button');
const shoppingListUl = document.getElementById('shopping-list-ul');
const completedListUl = document.getElementById('completed-list-ul');
const pastListsUl = document.getElementById('past-lists-ul');

// --- 3. GLOBAL STATE VARIABLES ---
let activeListId = null;
let unsubscribeFromItems = null;
let unsubscribeFromLists = null;

// --- 4. CORE FUNCTIONS ---

function formatDate(timestamp) {
    if (!timestamp) return '...';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("el-GR", {
        day: 'numeric', month: 'long', year: 'numeric'
    });
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
            li.innerHTML = `<input type="checkbox" id="${id}" ${item.completed ? 'checked' : ''}><label for="${id}">${item.name}</label>`;
            
            item.completed ? completedListUl.appendChild(li) : shoppingListUl.appendChild(li);

            li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                // *** THE FIX IS HERE: Use 'itemsRef' instead of 'itemsCollection' ***
                itemsRef.doc(id).update({ completed: e.target.checked });
            });
        });
    });
}

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

// --- 5. EVENT LISTENERS & AUTH LOGIC ---

const addItem = () => {
    const itemName = itemInput.value.trim();
    if (itemName && activeListId) {
        db.collection('lists').doc(activeListId).collection('items').add({
            name: itemName,
            completed: false
        });
        itemInput.value = '';
        itemInput.focus();
    }
};
addButton.addEventListener('click', addItem);
itemInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') addItem(); });

completeListButton.addEventListener('click', async () => {
    if (!activeListId || !confirm('Είστε σίγουροι ότι θέλετε να ολοκληρώσετε αυτή τη λίστα;')) return;

    const currentListRef = db.collection('lists').doc(activeListId);
    await currentListRef.update({
        isActive: false,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (unsubscribeFromItems) unsubscribeFromItems();
    activeListId = null;
    shoppingListUl.innerHTML = '';
    completedListUl.innerHTML = '';

    await createNewList();
});

// --- Main Authentication Logic ---
auth.onAuthStateChanged(user => {
    if (user) {
        const userDocRef = db.collection('allowedUsers').doc(user.uid);
        userDocRef.get().then((doc) => {
            if (doc.exists) {
                // --- USER IS AUTHORIZED ---
                document.body.classList.add('logged-in');
                userNameSpan.textContent = user.displayName;
                logoutButton.onclick = () => auth.signOut();
                
                // Find active list or create one
                db.collection('lists').where('isActive', '==', true).limit(1).get().then(snapshot => {
                    snapshot.empty ? createNewList() : loadList(snapshot.docs[0]);
                });

                // Listen for past lists
                if(unsubscribeFromLists) unsubscribeFromLists();
                unsubscribeFromLists = db.collection('lists').where('isActive', '==', false).orderBy('completedAt', 'desc').limit(10)
                    .onSnapshot(snapshot => {
                        pastListsUl.innerHTML = '';
                        snapshot.docs.forEach(doc => {
                            const list = doc.data();
                            const listId = doc.id;
                            
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <div class="past-list-header" data-id="${listId}">
                                    Λίστα της ${formatDate(list.completedAt)}
                                </div>
                                <ul class="past-list-items"></ul>
                            `;
                            pastListsUl.appendChild(li);
                        });
                    });

            } else { // User not authorized logic
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('unauthorized-section').style.display = 'block';
                unauthorizedLogoutButton.onclick = () => auth.signOut();
            }
        });
    } else { // User logged out logic
        document.body.classList.remove('logged-in');
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('unauthorized-section').style.display = 'none';
        if (unsubscribeFromItems) unsubscribeFromItems();
        if (unsubscribeFromLists) unsubscribeFromLists();
        activeListId = null;
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
            itemLi.textContent = item.name;
            if (item.completed) {
                itemLi.style.textDecoration = 'line-through';
                itemLi.style.color = '#888';
            }
            itemsUl.appendChild(itemLi);
        });
    }

    itemsUl.style.display = isOpen ? 'block' : 'none';
});

loginButton.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));