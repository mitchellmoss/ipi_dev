const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('counter.db');


// Initialize the database table
db.run(`
  CREATE TABLE IF NOT EXISTS counts (
    date TEXT PRIMARY KEY,
    palletsReceived INTEGER,
    palletsDelivered INTEGER
  )
`);

// Function to ensure there's a row for today's date
async function ensureTodaysRowExists() {
  const today = new Date().toISOString().split('T')[0]; // Format today's date as YYYY-MM-DD
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO counts (date, palletsReceived, palletsDelivered) VALUES (?, 0, 0)', [today], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

app.get('/counts', async (req, res) => {
  const date = req.query.date;

  try {
    db.get('SELECT * FROM counts WHERE date = ?', [date], (err, row) => {
      if (err) {
        console.error(err.message);
        res.sendStatus(500);
        return;
      }

      if (row) {
        res.send({
          palletsReceived: row.palletsReceived,
          palletsDelivered: row.palletsDelivered
        });
      } else {
        res.send({
          palletsReceived: 0,
          palletsDelivered: 0
        });
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    res.sendStatus(500);
  }
});

app.get('/', async (_, res) => {
  try {
    await ensureTodaysRowExists();
    db.get('SELECT * FROM counts ORDER BY date DESC LIMIT 1', (err, row) => {
      if (err) {
        console.error(err.message);
        res.sendStatus(500);
        return;
      }

      res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>

          #date-selector {
            font-size: 150%; /* Increase the text size by 50% */
            height: 50px;
          }

            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              text-align: center;
              font-size: 350%; /* Increase the text size by 50% */
              background-color: lightyellow;
            }

            .counter {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 100%;
              max-width: 1200px;
              padding: 0 20px;
            }
            button {
              font-size: 250%; /* Increase the button size by 50% */
              
            }
            @media (max-width: 600px) {
              .counter {
                flex-direction: column;
                align-items: stretch;
              }
            }
          </style>
        </head>
        <body>
    <h1>Pallet Counter</h1>
    <h2>Today's Date: ${new Date().toISOString().split('T')[0]}</h2>
    <div>
      <button id="received-button">Received</button>
      <button id="delivered-button">Delivered</button>
    </div>



    <div class="counter">
      <div>Pallets Received: <span id="palletsReceived-count">${row ? row.palletsReceived : 0}</span></div>
      <div>Pallets Delivered: <span id="palletsDelivered-count">${row ? row.palletsDelivered : 0}</span></div>
    </div>
    
    <div>
    <input type="date" id="date-selector" value="${new Date().toISOString().split('T')[0]}">
  </div>
          <script>
          document.getElementById('received-button').addEventListener('click', function() {
            updateCount('palletsReceived');
            this.style.backgroundColor = this.style.backgroundColor === 'lightblue' ? 'purple' : 'lightblue';
          });

          document.getElementById('delivered-button').addEventListener('click', function() {
            updateCount('palletsDelivered');
            this.style.backgroundColor = this.style.backgroundColor === 'lightblue' ? 'purple' : 'lightblue';
          });

            document.getElementById('date-selector').addEventListener('change', () => {
              getCountsForDate();
            });
            
            function updateCount(type) {
              const date = document.getElementById('date-selector').value;
              fetch('/' + type + '?date=' + date).then(response => response.json()).then(data => {
                if (data.count) {
                  document.getElementById(type + '-count').textContent = data.count;
                }
              });
                } 
                
                
              


            function getCountsForDate() {
              const date = document.getElementById('date-selector').value;
              fetch('/counts?date=' + date).then(response => response.json()).then(data => {
                document.getElementById('palletsReceived-count').textContent = data.palletsReceived;
                document.getElementById('palletsDelivered-count').textContent = data.palletsDelivered;
              });
            }
          </script>
        </body>
      </html>
      `);
      });

      } catch (err)  {
      console.error('Database error:', err);
      res.sendStatus(500);
      }
      });

      // Function to update count
      function updateCount(type, date) {
        return new Promise((resolve, reject) => {
          db.run(`UPDATE counts SET ${type} = ${type} + 1 WHERE date = ?`, [date], (err) => {
            if (err) reject(err);
            else {
              db.get(`SELECT ${type} FROM counts WHERE date = ?`, [date], (err, row) => {
                if (err) reject(err);
                else if (row) resolve(row[type]); // Ensure row is not undefined
                else resolve(0); // Default to 0 if no row found
              });
            }
          });
        });
      }

      

      // Unified endpoint for received/delivered updates
      app.get('/:type', async (req, res) => {
        const { type } = req.params;
        const date = req.query.date;

        if (!['palletsReceived', 'palletsDelivered'].includes(type)) {
          res.status(400).send('Invalid type');
          return;
        }

        try {
          // Ensure the row for the current date exists before updating the count
          await ensureRowExists(date);
          const updatedCount = await updateCount(type, date);
          res.status(200).send({ count: updatedCount });
        } catch (err) {
          console.error('Error updating ' + type + ':', err);
          res.sendStatus(500);
        }
      });

      function ensureRowExists(date) {
        return new Promise((resolve, reject) => {
          const query = `
            INSERT OR IGNORE INTO counts (date, palletsReceived, palletsDelivered)
            VALUES (?, 0, 0)
          `;
          db.run(query, [date], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      process.env.TZ = 'America/New_York';
      app.listen(3000, () => {
      console.log('Listening on port 3000');
      ensureTodaysRowExists().then(() => console.log('Database initialized')).catch(err => console.error('Error initializing database:', err));
      });
