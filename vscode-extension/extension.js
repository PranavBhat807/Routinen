const vscode = require('vscode');
const ApiClient = require('./api');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    console.log('Smart Routine Extension is now active!');

    const apiClient = new ApiClient(context);

    // TreeAPI
    const taskProvider = new SmartRoutineTaskProvider(apiClient);
    vscode.window.registerTreeDataProvider('smartRoutineTasks', taskProvider);

    // Commands
    let loginDisposable = vscode.commands.registerCommand('smart-routine.login', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter Email' });
        if (!email) return;
        
        const password = await vscode.window.showInputBox({ prompt: 'Enter Password', password: true });
        if (!password) return;

        try {
            const success = await apiClient.login(email, password);
            if (success) {
                vscode.window.showInformationMessage('Login successful!');
                taskProvider.refresh();
            } else {
                vscode.window.showErrorMessage('Login failed. Check credentials.');
            }
        } catch (err) {
            vscode.window.showErrorMessage('Login error: ' + err.message);
        }
    });

    let signupDisposable = vscode.commands.registerCommand('smart-routine.signup', async () => {
        const name = await vscode.window.showInputBox({ prompt: 'Enter Name' });
        if (!name) return;

        const email = await vscode.window.showInputBox({ prompt: 'Enter Email' });
        if (!email) return;
        
        const password = await vscode.window.showInputBox({ prompt: 'Enter Password', password: true });
        if (!password) return;

        try {
            const success = await apiClient.signup(name, email, password);
            if (success) {
                vscode.window.showInformationMessage('Signup successful! You are now logged in.');
                taskProvider.refresh();
            } else {
                vscode.window.showErrorMessage('Signup failed.');
            }
        } catch (err) {
            vscode.window.showErrorMessage('Signup error: ' + err.message);
        }
    });

    let refreshDisposable = vscode.commands.registerCommand('smart-routine.refresh', () => {
        taskProvider.refresh();
    });

    let completeDisposable = vscode.commands.registerCommand('smart-routine.completeTask', async (item) => {
        if (!item) return;
        try {
            const success = await apiClient.completeTask(item.taskId);
            if (success) {
                vscode.window.showInformationMessage(`Task "${item.label}" completed!`);
                taskProvider.refresh();
            } else {
                vscode.window.showErrorMessage('Failed to complete task.');
            }
        } catch (err) {
            vscode.window.showErrorMessage('Error completing task: ' + err.message);
        }
    });

    let addTaskDisposable = vscode.commands.registerCommand('smart-routine.addTask', async () => {
        const title = await vscode.window.showInputBox({ prompt: 'Task Title', placeHolder: 'e.g. Finish report' });
        if (!title) return;

        const description = await vscode.window.showInputBox({ prompt: 'Description (optional)' });
        const estimatedMinutesStr = await vscode.window.showInputBox({ prompt: 'Estimated Minutes', value: '30' });
        const estimatedMinutes = parseInt(estimatedMinutesStr || '30');
        
        const priority = await vscode.window.showQuickPick(['High', 'Medium', 'Low'], { placeHolder: 'Priority' }) || 'Medium';

        const taskData = {
            title,
            description,
            estimatedMinutes,
            priority: priority.toLowerCase(),
            dueDate: new Date().toISOString().slice(0, 10) // Default to today
        };

        const success = await apiClient.createTask(taskData);
        if (success) {
            vscode.window.showInformationMessage('Task created!');
            taskProvider.refresh();
        } else {
            vscode.window.showErrorMessage('Failed to create task.');
        }
    });

    let editTaskDisposable = vscode.commands.registerCommand('smart-routine.editTask', async (item) => {
        if (!item) return;

        const task = await apiClient.getTask(item.taskId);
        if (!task) {
            vscode.window.showErrorMessage('Failed to fetch task details.');
            return;
        }

        const title = await vscode.window.showInputBox({ prompt: 'Task Title', value: task.title });
        if (!title) return;

        const description = await vscode.window.showInputBox({ prompt: 'Description', value: task.description || '' });
        const estimatedMinutesStr = await vscode.window.showInputBox({ prompt: 'Estimated Minutes', value: (task.estimatedMinutes || 30).toString() });
        const estimatedMinutes = parseInt(estimatedMinutesStr || '30');
        const setTime = await vscode.window.showInputBox({ prompt: 'Time', value: (task.setTime || '10:00').toString() }); //High risk
        
        // QuickPick doesn't support pre-selecting easily without complex object, but this is fine
        const priority = await vscode.window.showQuickPick(['High', 'Medium', 'Low'], { placeHolder: 'Priority (current: ' + task.priority + ')' }) || task.priority;

        const taskData = {
            ...task,
            title,
            description,
            estimatedMinutes,
            priority: priority.toLowerCase(),
            setTime
        };

        const success = await apiClient.updateTask(item.taskId, taskData);
        if (success) {
            vscode.window.showInformationMessage('Task updated!');
            taskProvider.refresh();
        } else {
            vscode.window.showErrorMessage('Failed to update task.');
        }
    });

    let restructureDisposable = vscode.commands.registerCommand('smart-routine.restructureTasks', async () => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "AI is restructuring your day...",
            cancellable: false
        }, async (progress) => {
            const plan = await apiClient.getAIPlan();
            if (!plan || !plan.schedule) {
                vscode.window.showErrorMessage('Failed to get AI plan.');
                return;
            }

            // Show plan in a new untitled document or output channel
            const docContent = `AI Generated Schedule for ${plan.date}\n\n` + 
                plan.schedule.map(t => `[${t.start.slice(11, 16)}] ${t.title} (${t.durationMinutes}m)`).join('\n') +
                `\n\nSuggestions:\n` +
                plan.suggestions.map(s => `- ${s.text || s}`).join('\n');

            const doc = await vscode.workspace.openTextDocument({ content: docContent, language: 'markdown' });
            vscode.window.showTextDocument(doc);
        });
    });

    context.subscriptions.push(
        loginDisposable,
        signupDisposable, 
        refreshDisposable, 
        completeDisposable,
        addTaskDisposable,
        editTaskDisposable,
        restructureDisposable,
        statusBarItem
    );
    statusBarItem.text = "$(checklist) Smart Routine";
    statusBarItem.tooltip = "Manage your routine";
    statusBarItem.command = "smart-routine.refresh"; // click to refresh for now
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

function deactivate() {}

class SmartRoutineTaskProvider {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (element) {
            return []; // No nesting for now
        }

        const tasks = await this.apiClient.getTasks();
        
        if (tasks === null) {
            // Token expired or invalid
            const item = new vscode.TreeItem("Please Login");
            item.command = { command: 'smart-routine.login', title: 'Login' };
            return [item];
        }

        if (!tasks || tasks.length === 0) {
            return [new vscode.TreeItem("No tasks found (or server error)")];
        }

        return tasks.map(t => {
            const label = t.title || 'Untitled Task';
            const item = new TaskItem(label, vscode.TreeItemCollapsibleState.None, t.id);
            item.description = t.startTime ? `${t.startTime} - ${t.endTime}` : 'Anytime';
            item.tooltip = t.description || 'No description';
            item.contextValue = 'task'; // For inline commands
            return item;
        });
    }
}

class TaskItem extends vscode.TreeItem {
    constructor(label, collapsibleState, taskId) {
        super(label, collapsibleState);
        this.taskId = taskId;
        this.iconPath = new vscode.ThemeIcon('circle-outline');
    }
}

module.exports = {
    activate,
    deactivate
};
