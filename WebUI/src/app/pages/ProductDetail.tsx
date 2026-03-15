const handleMouseDown = async () => {
  if (!isUnlocked) return;
  
  try {
    const config = loadProductConfig() as ProductConfig;
    
    if (!config || !config.selectedSteps || config.selectedSteps.length === 0) {
      // If nothing is selected, open the config page automatically
      window.location.href = '/config';
      return;
    }
    
    // Create execution modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: #1e1e1e;
      color: #fff;
      padding: 2rem;
      border-radius: 8px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', monospace;
    `;
    
    modalContent.innerHTML = `
      <h2 style="margin-top: 0; color: #4CAF50;">Executing Scripts...</h2>
      <div id="executionLog" style="background: #000; padding: 1rem; border-radius: 4px; height: 300px; overflow-y: auto; margin: 1rem 0; font-size: 12px;"></div>
      <div id="progressBar" style="background: #333; height: 20px; border-radius: 10px; overflow: hidden; margin: 1rem 0;">
        <div id="progressFill" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <button id="closeBtn" style="padding: 0.5rem 1rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Close</button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    const executionLog = document.getElementById('executionLog');
    const progressFill = document.getElementById('progressFill');
    const closeBtn = document.getElementById('closeBtn');
    
    let currentStep = 0;
    const totalSteps = config.selectedSteps.length;
    
    // Function to log messages
    const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#74c0fc';
      executionLog!.innerHTML += `<div style="color: ${color};">[${timestamp}] ${message}</div>`;
      executionLog!.scrollTop = executionLog!.scrollHeight;
    };
    
    // Function to execute a PowerShell script
    const executeScript = async (step: ExecutionStep, index: number) => {
      try {
        log(`Starting execution: ${step.name || 'Unnamed step'}`);
        
        // Get script path - use provided path or construct from step name
        const scriptPath = step.scriptPath || `./scripts/${step.name.replace(/\s+/g, '_')}.ps1`;
        
        // Prepare PowerShell command with elevated privileges if needed
        const powershellCommand = `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}"`;
        
        // Execute the PowerShell script using Node.js child_process
        const { stdout, stderr } = await execAsync(powershellCommand, {
          timeout: 30000, // 30 seconds timeout
          windowsHide: true,
          shell: true,
          cwd: process.cwd() // Ensure we're in the correct working directory
        });
        
        log(`✓ ${step.name} completed successfully`, 'success');
        
        if (stdout && stdout.trim()) {
          log(`Output: ${stdout.trim()}`);
        }
        
        if (stderr && stderr.trim()) {
          log(`Warning: ${stderr.trim()}`, 'error');
        }
        
      } catch (error: any) {
        log(`✗ Error executing ${step.name}: ${error.message}`, 'error');
        
        // Log stderr if available
        if (error.stderr) {
          log(`Error details: ${error.stderr}`, 'error');
        }
        
        throw error;
      }
    };
    
    // Execute all steps
    const executeAllSteps = async () => {
      try {
        log(`Starting execution of ${totalSteps} steps...`);
        log(`Working directory: ${process.cwd()}`);
        
        for (let i = 0; i < config.selectedSteps.length; i++) {
          const step = config.selectedSteps[i];
          currentStep = i + 1;
          
          // Update progress bar
          const progress = (currentStep / totalSteps) * 100;
          progressFill!.style.width = `${progress}%`;
          
          // Execute the script
          await executeScript(step, i);
          
          // Small delay between scripts for better UX
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        log('All scripts executed successfully!', 'success');
        
      } catch (error) {
        log(`Execution stopped due to error: ${(error as Error).message}`, 'error');
      } finally {
        log('Execution finished');
        closeBtn!.style.display = 'inline-block';
      }
    };
    
    // Start execution
    executeAllSteps();
    
    // Close button handler
    closeBtn!.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
  } catch (error) {
    console.error('Failed to load configuration:', error);
    alert('Failed to load configuration. Please check your settings.');
  }
};