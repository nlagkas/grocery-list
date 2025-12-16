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
  let unsubscribeFromItems = null; // Listener for items in the active list
  let unsubscribeFromLists = null; // Listener for the list of past lists
  
  // --- 4. CORE FUNCTIONS ---
  
  // Function to format a Firestore timestamp into a readable date
  function formatDate(timestamp) {
      if (!timestamp) return '';
      return new Date(timestamp.seconds * 1000).toLocaleDateString("el-GR", {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
      });
  }
  
  // Loads a specific list and listens for its items
  function loadList(listDoc) {
      activeListId = listDoc.id;
      const listData = listDoc.data();
      listTitle.textContent = `Λίστα: ${formatDate(listData.createdAt)}`;
  
      // Unsubscribe from any previous item listener
      if (unsubscribeFromItems) unsubscribeFromItems();
  
      const itemsCollection = db.collection('lists').doc(activeListId).collection('items');
      
      // Listen for real-time updates on items
      unsubscribeFromItems = itemsCollection.orderBy('name').onSnapshot(snapshot => {
          shoppingListUl.innerHTML = '';
          completedListUl.innerHTML = '';
          snapshot.docs.forEach(doc => {
              const item = doc.data();
              const id = doc.id;
              const li = document.createElement('li');
              li.innerHTML = `<input type="checkbox" id="${id}" ${item.completed ? 'checked' : ''}><label for="${id}">${item.name}</label>`;
              
              if (item.completed) {
                  completedListUl.appendChild(li);
              } else {
                  shoppingListUl.appendChild(li);
              }
  
              // Add event listener for the checkbox
              li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                  itemsCollection.doc(id).update({ completed: e.target.checked });
              });
          });
      });
  }
  
  // Creates a new, empty, active list
  async function createNewList() {
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
  
  // Handles adding a new item to the currently active list
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
  
  // Completes the current list and creates a new one
  completeListButton.addEventListener('click', async () => {
      if (!activeListId) return;
  
      const currentListRef = db.collection('lists').doc(activeListId);
      await currentListRef.update({
          isActive: false,
          completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  
      // The main onAuthStateChanged listener will automatically create a new list.
  });
  
  
  // Main Authentication Logic
  auth.onAuthStateChanged(user => {
      if (user) {
          const userDocRef = db.collection('allowedUsers').doc(user.uid);
          userDocRef.get().then((doc) => {
              if (doc.exists) {
                  // --- USER IS AUTHORIZED ---
                  document.body.classList.add('logged-in');
                  userNameSpan.textContent = user.displayName;
                  logoutButton.onclick = () => auth.signOut();
                  
                  // Find the active list or create a new one
                  db.collection('lists').where('isActive', '==', true).limit(1).get().then(snapshot => {
                      if (snapshot.empty) {
                          createNewList();
                      } else {
                          loadList(snapshot.docs[0]);
                      }
                  });
  
                  // Listen for past lists
                  if(unsubscribeFromLists) unsubscribeFromLists();
                  unsubscribeFromLists = db.collection('lists').where('isActive', '==', false).orderBy('completedAt', 'desc').limit(10)
                      .onSnapshot(snapshot => {
                          pastListsUl.innerHTML = '';
                          snapshot.docs.forEach(doc => {
                              const list = doc.data();
                              const li = document.createElement('li');
                              li.textContent = `Λίστα της ${formatDate(list.completedAt)}`;
                              pastListsUl.appendChild(li);
                          });
                      });
  
              } else {
                  // --- USER IS NOT AUTHORIZED ---
                  document.getElementById('login-section').style.display = 'none';
                  document.getElementById('unauthorized-section').style.display = 'block';
                  unauthorizedLogoutButton.onclick = () => auth.signOut();
              }
          });
      } else {
          // --- USER IS LOGGED OUT ---
          document.body.classList.remove('logged-in');
          document.getElementById('login-section').style.display = 'block';
          document.getElementById('unauthorized-section').style.display = 'none';
          
          // Unsubscribe from all listeners
          if (unsubscribeFromItems) unsubscribeFromItems();
          if (unsubscribeFromLists) unsubscribeFromLists();
          activeListId = null;
      }
  });
  
  loginButton.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));