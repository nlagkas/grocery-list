// --- 1. INITIALIZATION ---
// PASTE THE FIREBASE CONFIGURATION OBJECT YOU COPIED EARLIER HERE
  const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.firebasestorage.app",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // --- 2. GET HTML ELEMENTS ---
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const userNameSpan = document.getElementById('user-name');
  const body = document.body;
  const itemInput = document.getElementById('item-input');
  const addButton = document.getElementById('add-button');
  const shoppingListUl = document.getElementById('shopping-list-ul');
  const completedListUl = document.getElementById('completed-list-ul');
  
  // --- 3. AUTHENTICATION LOGIC ---
  const signIn = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  const signOut = () => auth.signOut();
  
  loginButton.addEventListener('click', signIn);
  logoutButton.addEventListener('click', signOut);
  
  let unsubscribeFromList; // This will hold our real-time listener
  
  // The main listener for authentication state changes
  auth.onAuthStateChanged(user => {
      if (user) {
          // User is logged in
          //console.log(`User Logged In! Name: ${user.displayName}, UID: ${user.uid}`);
          body.classList.add('logged-in');
          userNameSpan.textContent = user.displayName;
  
          // Connect to the shared list in Firestore
          const listCollection = db.collection('shared-lists').doc('our-family-list').collection('items');
  
          // Function to add item
          const addItem = () => {
              const itemName = itemInput.value.trim();
              if (itemName) {
                  listCollection.add({
                      name: itemName,
                      completed: false,
                      createdAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                  itemInput.value = '';
              }
          };
  
          addButton.onclick = addItem;
          itemInput.onkeyup = (event) => { if (event.key === 'Enter') addItem(); };
  
          // Start listening to the list in real-time
          unsubscribeFromList = listCollection.orderBy('createdAt').onSnapshot(snapshot => {
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
  
                  const checkbox = li.querySelector('input[type="checkbox"]');
                  checkbox.addEventListener('change', () => {
                      listCollection.doc(id).update({ completed: checkbox.checked });
                  });
              });
          });
      } else {
          // User is logged out
          body.classList.remove('logged-in');
          if (unsubscribeFromList) unsubscribeFromList(); // Stop listening
      }
  });