    /* momentu_full.js
      Full working simulation with proper sprites, collision, and quiz mode
    */

    // ---------- Config: object types ----------
    const OBJECT_TYPES = [
      { key: 'car', label: 'Car', emoji: '🚗', defaultMass: 1200, scale: 1.0, kind: 'vehicle' },
      { key: 'truck', label: 'Truck', emoji: '🚚', defaultMass: 8000, scale: 1.2, kind: 'vehicle' },
      { key: 'motorcycle', label: 'Motorcycle', emoji: '🛵', defaultMass: 200, scale: 0.8, kind: 'vehicle' },
      { key: 'bicycle', label: 'Bicycle', emoji: '🚲', defaultMass: 15, scale: 0.7, kind: 'vehicle' },
      { key: 'ball', label: 'Ball', emoji: '⚽', defaultMass: 0.45, scale: 0.5, kind: 'ball' },
      { key: 'rocket', label: 'Rocket', emoji: '🚀', defaultMass: 20000, scale: 1.0, kind: 'rocket' },
      { key: 'dog', label: 'Dog', emoji: '🐶', defaultMass: 18, scale: 0.6, kind: 'walker' },
      { key: 'walker', label: 'Walking Person', emoji: '🚶', defaultMass: 70, scale: 0.8, kind: 'walker' },
      { key: 'airplane', label: 'Airplane', emoji: '✈️', defaultMass: 40000, scale: 1.6, kind: 'aircraft' }
    ];

    // ---------- DOM ----------
    const objSelect = document.getElementById('objSelect');
    const addObjBtn = document.getElementById('addObjBtn');
    const instancesList = document.getElementById('instancesList');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const revealBtn = document.getElementById('revealBtn');
    const answersArea = document.getElementById('answersArea');
    const simMode = document.getElementById('simMode');
    const collisionControls = document.getElementById('collisionControls');

    /* simMode.addEventListener('change', () => {
      if(simMode.value === 'collision'){
        refreshCollisionSelects(); // populate dropdowns
        collisionControls.style.display = instances.length >= 2 ? 'block' : 'none';
      } else {
        collisionControls.style.display = 'none';
      }
    });*/

    simMode.addEventListener('change', updateCollisionUI);

    const canvas = document.getElementById('simCanvas');
    const ctx = canvas.getContext('2d');

    let instances = []; // object instances
    let nextId = 1;
    let animId = null;
    let revealTimeout = null;
    const REVEAL_MS = 30000; // 30 sec

    // ---------- Utilities ----------
    function findType(key){ return OBJECT_TYPES.find(o => o.key === key); }
    function randColor(idx){
      const palette = ['#ef4444','#0891b2','#6366f1','#f97316','#10b981','#7c3aed','#f59e0b','#0ea5a4'];
      return palette[idx % palette.length];
    }

    function getCollisionRadius(type){
      switch(type.key){
        case 'car': return 40 * type.scale;
        case 'truck': return 60 * type.scale;
        case 'motorcycle': return 32.4 * type.scale;
        case 'bicycle': return 33.6 * type.scale;
        case 'ball': return 8.4 * type.scale;
        case 'rocket': return 18 * type.scale;
        case 'dog': return 27.2 * type.scale;
        case 'walker': return 5.6 * type.scale;
        case 'airplane': return 59.4 * type.scale;
        default: return 20 * type.scale;
      }
    }

    // populate select
    OBJECT_TYPES.forEach(o=>{
      const opt = document.createElement('option');
      opt.value = o.key;
      opt.textContent = `${o.emoji} ${o.label}`;
      objSelect.appendChild(opt);
    });

    // ---------- Instance UI ----------
    function createInstancePanel(inst){
      const wrap = document.createElement('div');
      wrap.className = 'instance';
      wrap.id = `inst-${inst.id}`;
      const left = document.createElement('div'); left.className='left';
      left.innerHTML = `<div><strong style="font-size:15px">${inst.emoji} ${inst.label}</strong> <span class="muted" style="margin-left:6px;font-size:13px">#${inst.id}</span></div>`;
      
      const sliders = document.createElement('div'); sliders.className='sliders';
      const massNum = document.createElement('input'); massNum.type='number'; massNum.value=inst.mass; massNum.step='any'; massNum.min=0; massNum.style.width='90px';
      const velNum = document.createElement('input'); velNum.type='number'; velNum.value=inst.vel; velNum.step='0.1'; velNum.min=0; velNum.style.width='80px';
      sliders.appendChild(document.createTextNode('Mass (kg): ')); sliders.appendChild(massNum);
      sliders.appendChild(document.createTextNode(' Velocity (m/s): ')); sliders.appendChild(velNum);
      left.appendChild(sliders);

      // quiz input
      const quizDiv = document.createElement('div'); quizDiv.style.marginTop='6px';
      quizDiv.innerHTML = `
        <label class="small muted">Your Momentum:</label>
        <input type="number" class="quizInput" id="quiz-${inst.id}" placeholder="Enter momentum">
        <span id="quiz-feedback-${inst.id}"></span>
      `;
      left.appendChild(quizDiv);

      const right = document.createElement('div'); right.style.textAlign='right';
      right.innerHTML = `<div style="font-size:13px" class="small muted">Momentum: <span id="p-${inst.id}">—</span></div>`;
      const removeBtn = document.createElement('button'); removeBtn.textContent='Remove'; removeBtn.className='removeBtn'; removeBtn.onclick=()=>removeInstance(inst.id);
      right.appendChild(removeBtn);

      wrap.appendChild(left); wrap.appendChild(right);
      instancesList.appendChild(wrap);

      massNum.oninput=()=>{ inst.mass=parseFloat(massNum.value)||0; updateMomentumDisplay(inst); };
      velNum.oninput=()=>{ inst.vel=parseFloat(velNum.value)||0; updateMomentumDisplay(inst); };

      updateMomentumDisplay(inst);
    }

    function updateMomentumDisplay(inst){
      const pSpan = document.getElementById(`p-${inst.id}`);
      if(!pSpan) return;

      const quizMode = document.getElementById('quizToggle')?.checked; // check if quiz mode checkbox exists
      if(quizMode){
        pSpan.textContent = '—'; // hide momentum in quiz mode
      } else {
        pSpan.textContent = (inst.mass * inst.vel).toLocaleString(undefined,{maximumFractionDigits:2});
      }
    }


    // ---------- Add / Remove ----------
    function addInstance(typeKey){
      const t = findType(typeKey);
      if(!t) return;
      const id = nextId++;
      const inst = {
        id,
        typeKey,
        label: t.label,
        emoji: t.emoji,
        mass: t.defaultMass,
        vel: Math.max(0.5,Math.round(t.defaultMass*0.02)),
        x: Math.random() * 200 + 40,
        y: canvas.height/2,
        dir:1,
        dirX:1,
        color: randColor(id),
        scale: t.scale,
        angle:0,
        legPhase:Math.random()*Math.PI*2,
        type:t.kind,
        radius: getCollisionRadius(t)
      };
      instances.push(inst);
      createInstancePanel(inst);
      layoutInstances();
      drawOnce();
      refreshCollisionSelects();
    }

    function removeInstance(id){
      instances = instances.filter(i=>i.id!==id);
      const el=document.getElementById(`inst-${id}`); if(el) el.remove();
      drawOnce();
      refreshCollisionSelects();
    }
    updateCollisionUI();


    // ---------- Layout ----------
    function layoutInstances(){
      if(simMode.value==='collision') return; // keep collision objects in line
      const paddingTop=60, paddingBottom=60;
      const laneHeight=(canvas.height-paddingTop-paddingBottom)/instances.length;
      instances.forEach((inst,idx)=>{
        inst.y=paddingTop+laneHeight*idx+laneHeight/2;
        inst.x=40;
      });
    }


    // ---------- Draw helpers ----------
    function drawCar(inst,x,y){
      const s=1.0*inst.scale;
      ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      ctx.fillStyle=inst.color;
      ctx.beginPath(); ctx.roundRect(-40*s,-14*s,80*s,28*s,6*s); ctx.fill();
      ctx.fillStyle=shade(inst.color,-10);
      ctx.beginPath(); ctx.roundRect(-20*s,-26*s,40*s,18*s,4*s); ctx.fill();
      drawWheel(-22*s,16*s,10*s,inst.angle); drawWheel(22*s,16*s,10*s,inst.angle);
      ctx.restore();
    }
    function drawTruck(inst,x,y){
      const s=1.2*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      ctx.fillStyle=inst.color; ctx.fillRect(-50*s,-18*s,100*s,36*s);
      ctx.fillStyle=shade(inst.color,-10); ctx.fillRect(10*s,-26*s,30*s,20*s);
      drawWheel(-35*s,18*s,12*s,inst.angle); drawWheel(35*s,18*s,12*s,inst.angle);
      ctx.restore();
    }
    function drawMotorcycle(inst,x,y){
      const s=0.9*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      drawWheel(-26*s,14*s,10*s,inst.angle); drawWheel(26*s,14*s,10*s,inst.angle);
      ctx.strokeStyle=inst.color; ctx.lineWidth=4*s;
      ctx.beginPath(); ctx.moveTo(-20*s,10*s); ctx.lineTo(18*s,4*s); ctx.stroke();
      ctx.fillStyle="#333"; ctx.fillRect(-5*s,-6*s,18*s,8*s);
      ctx.fillStyle=inst.color; ctx.beginPath(); ctx.ellipse(0,-4*s,14*s,8*s,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#444"; ctx.lineWidth=3*s; ctx.beginPath(); ctx.moveTo(18*s,4*s); ctx.lineTo(28*s,-6*s); ctx.stroke();
      ctx.restore();
    }
    function drawBicycle(inst,x,y){
      const s=0.8*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      drawWheel(-30*s,12*s,12*s,inst.angle); drawWheel(30*s,12*s,12*s,inst.angle);
      ctx.strokeStyle=inst.color; ctx.lineWidth=3*s; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-30*s,12*s); ctx.lineTo(5*s,12*s); ctx.lineTo(0*s,-12*s); ctx.lineTo(-10*s,-12*s); ctx.lineTo(-30*s,12*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5*s,12*s); ctx.lineTo(30*s,12*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5*s,12*s); ctx.lineTo(10*s,-18*s); ctx.lineTo(0*s,-18*s); ctx.lineTo(20*s,-18*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5*s,-12*s); ctx.lineTo(10*s,-12*s); ctx.stroke();
      ctx.restore();
    }
    function drawBall(inst,x,y){
      const s=0.6*inst.scale; ctx.save(); ctx.translate(x,y); ctx.rotate(inst.angle);
      ctx.beginPath(); ctx.arc(0,0,14*s,0,Math.PI*2); ctx.fillStyle='#fef3c7'; ctx.fill();
      ctx.strokeStyle='#111827'; ctx.beginPath(); ctx.moveTo(-8*s,-8*s); ctx.lineTo(8*s,8*s); ctx.moveTo(-8*s,8*s); ctx.lineTo(8*s,-8*s); ctx.stroke();
      ctx.restore();
    }
    function drawRocket(inst,x,y){
      const s=0.9*inst.scale; ctx.save(); ctx.translate(x,y); ctx.rotate(inst.dir<0?Math.PI:0);
      ctx.fillStyle='#e11d48'; ctx.beginPath(); ctx.moveTo(0,-30*s); ctx.quadraticCurveTo(20*s,-10*s,0,20*s); ctx.quadraticCurveTo(-20*s,-10*s,0,-30*s); ctx.fill();
      ctx.fillStyle='#bfdbfe'; ctx.beginPath(); ctx.arc(0,-4*s,6*s,0,Math.PI*2); ctx.fill();
      const flame=Math.sin(inst.angle*3)*6+12; ctx.beginPath(); ctx.fillStyle='orange';
      ctx.moveTo(-6*s,22*s); ctx.quadraticCurveTo(0,22*s+flame,6*s,22*s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawDog(inst,x,y){
      const s=0.8*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      ctx.fillStyle="#d19a66"; ctx.fillRect(-20*s,-12*s,40*s,20*s);
      ctx.beginPath(); ctx.arc(24*s,-8*s,10*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#8b5a2b"; ctx.fillRect(20*s,-16*s,8*s,8*s);
      ctx.strokeStyle="#8b5a2b"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-22*s,-10*s); ctx.quadraticCurveTo(-30*s,-18*s,-32*s,-10*s); ctx.stroke();
      const lp=inst.legPhase; ctx.strokeStyle="#5a3d1e"; ctx.lineWidth=4; const legY=10*s;
      ctx.beginPath(); ctx.moveTo(12*s,legY); ctx.lineTo(12*s,legY+Math.sin(lp)*6*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4*s,legY); ctx.lineTo(4*s,legY+Math.sin(lp+Math.PI)*6*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8*s,legY); ctx.lineTo(-8*s,legY+Math.sin(lp+1)*6*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16*s,legY); ctx.lineTo(-16*s,legY+Math.sin(lp+Math.PI+1)*6*s); ctx.stroke();
      ctx.restore();
    }
    function drawWalker(inst,x,y){
      const s=0.7*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      ctx.strokeStyle='#111827'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,-18*s); ctx.lineTo(0,-4*s); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,-26*s,6*s,0,Math.PI*2); ctx.fillStyle='#fde68a'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0,-14*s); ctx.lineTo(-8*s,-6*s); ctx.moveTo(0,-14*s); ctx.lineTo(8*s,-6*s); ctx.stroke();
      const lp=inst.legPhase; ctx.beginPath(); ctx.moveTo(0,-4*s); ctx.lineTo(Math.sin(lp)*6*s,12*s); ctx.moveTo(0,-4*s); ctx.lineTo(Math.sin(lp+Math.PI)*6*s,12*s); ctx.stroke();
      ctx.restore();
    }
    function drawAirplane(inst,x,y){
      const s=1.1*inst.scale; ctx.save(); ctx.translate(x,y); if(inst.dir<0) ctx.scale(-1,1);
      ctx.fillStyle="#60a5fa"; ctx.beginPath(); ctx.roundRect(-40*s,-10*s,80*s,20*s,10*s); ctx.fill();
      ctx.beginPath(); ctx.ellipse(40*s,0,12*s,10*s,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#1e3a8a"; ctx.beginPath(); ctx.moveTo(-10*s,0); ctx.lineTo(10*s,-18*s); ctx.lineTo(30*s,-18*s); ctx.lineTo(10*s,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10*s,0); ctx.lineTo(10*s,18*s); ctx.lineTo(30*s,18*s); ctx.lineTo(10*s,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40*s,-10*s); ctx.lineTo(-54*s,-20*s); ctx.lineTo(-40*s,-6*s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawWheel(cx,cy,r,angle){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle='#111827'; ctx.fill(); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=2; ctx.stroke(); ctx.restore(); }
    function shade(hex,percent){ const col=hex.replace('#',''); const r=parseInt(col.substring(0,2),16); const g=parseInt(col.substring(2,4),16); const b=parseInt(col.substring(4,6),16); const f=n=>Math.max(0,Math.min(255,Math.round(n*(100+percent)/100))); return `rgb(${f(r)},${f(g)},${f(b)})`; }

    // ---------- Draw frame ----------
    // ---------- Draw frame ----------
    // ---------- Draw frame ----------
    function drawOnce(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#bfe9ff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#9ae6b4'; ctx.fillRect(0,canvas.height-60,canvas.width,60);

      instances.forEach(inst=>{
        // Highlight if colliding
        if(inst.colliding){
          ctx.save();
          ctx.strokeStyle='red';
          ctx.lineWidth=3;
          ctx.beginPath();
          ctx.arc(inst.x, inst.y-10, inst.radius+4, 0, Math.PI*2);
          ctx.stroke();
          ctx.restore();
        }

        const x=inst.x, y=inst.y;
        switch(inst.type){
          case 'vehicle': 
            if(inst.typeKey==='truck') drawTruck(inst,x,y);
            else if(inst.typeKey==='motorcycle') drawMotorcycle(inst,x,y);
            else if(inst.typeKey==='bicycle') drawBicycle(inst,x,y);
            else drawCar(inst,x,y); 
            break;
          case 'ball': drawBall(inst,x,y-10); break;
          case 'rocket': drawRocket(inst,x,y-30); break;
          case 'walker': 
            if(inst.typeKey==='dog') drawDog(inst,x,y-6); 
            else drawWalker(inst,x,y-6); 
            break;
          case 'aircraft': drawAirplane(inst,x,y-80); break;
          default: drawCar(inst,x,y);
        }
      });
    }


    // ---------- Animation ----------
    function animate(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#bfe9ff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#9ae6b4'; ctx.fillRect(0,canvas.height-60,canvas.width,60);
      
      instances.forEach(inst=>{
        inst.x+=inst.vel*inst.dirX*0.2;
        inst.angle+=inst.vel*0.05;
        const r = inst.radius || 40;
        if(inst.x>canvas.width-r || inst.x<r){
          inst.dirX*=-1;
          if(inst.x<r) inst.x=r;
          if(inst.x>canvas.width-r) inst.x=canvas.width-r;
        }
        inst.dir = inst.dirX;
      });

      if(simMode.value==='collision'){
        checkCollisions();
      }
      
      drawOnce();
      animId=requestAnimationFrame(animate);
    }

    // ---------- Collision ----------
    // ---------- Collision ----------
    function checkCollisions(){
      // Reset colliding state
      instances.forEach(inst => inst.colliding = false);

      for(let i=0;i<instances.length;i++){
        for(let j=i+1;j<instances.length;j++){
          const a=instances[i], b=instances[j];
              const dx=b.x-a.x;
          const rSum=a.radius+b.radius;
          if(Math.abs(dx) <= rSum){
            // 1D elastic collision formula
            // 1D elastic collision along X-axis
            const u1 = a.vel * a.dirX;
            const u2 = b.vel * b.dirX;

            const totalMass = a.mass + b.mass;
            const v1Final = ((a.mass - b.mass)/totalMass)*u1 + (2*b.mass/totalMass)*u2;
            const v2Final = ((b.mass - a.mass)/totalMass)*u2 + (2*a.mass/totalMass)*u1;


            a.vel = Math.abs(v1Final);
            b.vel = Math.abs(v2Final);

            a.dirX = Math.sign(v1Final) || 1;
            b.dirX = Math.sign(v2Final) || 1;
            a.dir = a.dirX;
            b.dir = b.dirX;

            // Make sure objects move apart
            const overlap = rSum - Math.abs(dx);
            a.x -= overlap * (b.mass/totalMass) * Math.sign(dx);
            b.x += overlap * (a.mass/totalMass) * Math.sign(dx);
            // Set collision flag
            a.colliding = true;
            b.colliding = true;
          }
        }
      }
    }

    // ---------- Collision UI ----------
    function refreshCollisionSelects(){
      const sel1 = document.getElementById('colObj1');
      const sel2 = document.getElementById('colObj2');
      if(!sel1 || !sel2) return;

      sel1.innerHTML = '';
      sel2.innerHTML = '';

      instances.forEach(inst => {
        const opt1 = document.createElement('option');
        opt1.value = inst.id;
        opt1.textContent = `${inst.emoji} ${inst.label} #${inst.id}`;
        sel1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = inst.id;
        opt2.textContent = `${inst.emoji} ${inst.label} #${inst.id}`;
        sel2.appendChild(opt2);
      });
    }

    function updateCollisionUI() {
      if (simMode.value === 'collision' && instances.length >= 2) {
        refreshCollisionSelects();
        collisionControls.style.display = 'block';
      } else {
        collisionControls.style.display = 'none';
      }
    }


    document.getElementById('collideBtn').onclick = () => {
      const id1 = parseInt(document.getElementById('colObj1').value);
      const id2 = parseInt(document.getElementById('colObj2').value);

      if(isNaN(id1) || isNaN(id2) || id1 === id2){
        alert("Please select two different objects to collide!");
        return;
      }

      const a = instances.find(inst => inst.id === id1);
      const b = instances.find(inst => inst.id === id2);

      if(!a || !b){
        alert("Selected objects not found!");
        return;
      }

      // Align both objects on the same vertical line
      const midY = canvas.height / 2;
      a.y = midY;
      b.y = midY;

      // Place a on RIGHT, b on LEFT
      const padding = 80;
      a.x = canvas.width - padding;  // right
      b.x = padding;                 // left

      // Assign velocities toward each other
      a.vel = 4 + Math.random() * 2;
      b.vel = 4 + Math.random() * 2;
      a.dirX = -1; // moving left
      b.dirX = 1;  // moving right
      a.dir = a.dirX;
      b.dir = b.dirX;

      // Set simMode to collision
      simMode.value = 'collision';
      updateCollisionUI();

      // Start animation immediately
      if(animId) cancelAnimationFrame(animId);
      animate();
    };




    // ---------- Buttons ----------
    addObjBtn.onclick = () => { 
      addInstance(objSelect.value); 
      updateCollisionUI(); 
    };

    startBtn.onclick=()=>{ if(animId) cancelAnimationFrame(animId); animate(); };
    resetBtn.onclick=()=>{
      if(animId) cancelAnimationFrame(animId); instances=[]; instancesList.innerHTML=''; nextId=1; drawOnce(); clearTimeout(revealTimeout);
    };
    revealBtn.onclick = () => {
      instances.forEach(inst => {
        const qInput = document.getElementById(`quiz-${inst.id}`);
        if(qInput) qInput.value = (inst.mass * inst.vel).toFixed(2);
        const pSpan = document.getElementById(`p-${inst.id}`);
        if(pSpan) pSpan.textContent = (inst.mass * inst.vel).toFixed(2); // reveal momentum
      });
    };

    // ---------- Quiz Mode ----------

    // Toggle momentum display when Quiz Mode changes
    const quizToggle = document.getElementById('quizToggle');
    quizToggle.addEventListener('change', () => {
      const quizOn = quizToggle.checked;
      instances.forEach(inst => {
        const pSpan = document.getElementById(`p-${inst.id}`);
        if(pSpan) pSpan.textContent = quizOn ? '—' : (inst.mass*inst.vel).toFixed(2);
        const qInput = document.getElementById(`quiz-${inst.id}`);
        if(qInput) qInput.disabled = !quizOn; // enable input only in quiz mode
      });
    });

    // Check Answers button
    const checkBtn = document.getElementById('checkBtn');
    checkBtn.addEventListener('click', () => {
      instances.forEach(inst => {
        const qInput = document.getElementById(`quiz-${inst.id}`);
        const pSpan = document.getElementById(`p-${inst.id}`);
        if(qInput && pSpan){
          const correct = (inst.mass*inst.vel).toFixed(2);
          const userVal = parseFloat(qInput.value).toFixed(2);
          pSpan.textContent = correct; // show correct momentum
          const feedback = document.getElementById(`quiz-feedback-${inst.id}`);
          if(feedback) feedback.textContent = (userVal == correct) ? '✅ Correct' : '❌ Wrong';
        }
      });
    });

    // Clear Quiz Answers button
    const clearQuiz = document.getElementById('clearQuiz');
    clearQuiz.addEventListener('click', () => {
      instances.forEach(inst => {
        const qInput = document.getElementById(`quiz-${inst.id}`);
        const feedback = document.getElementById(`quiz-feedback-${inst.id}`);
        const pSpan = document.getElementById(`p-${inst.id}`);
        if(qInput) qInput.value = '';
        if(feedback) feedback.textContent = '';
        if(pSpan) pSpan.textContent = '—'; // hide momentum again
      });
    });


    // ---------- Initial ----------
    drawOnce();

