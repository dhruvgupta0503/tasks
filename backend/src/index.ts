import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors())

const JWT_SECRET = 'JKJ4v-+89*&VY-gygiu'

interface Task {
  id: number
  title: string
  start_time: string
  end_time: string
  priority: number
  status: 'pending' | 'finished'
  user_id: string
}

interface User {
  email: string
  password: string
}

const auth = jwt({
  secret: JWT_SECRET,
})

class AuthController {
  static async login(c: any) {
    const { email, password } = await c.req.json()
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND password = ?'
    )
      .bind(email, password)
      .first()
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await sign({ email }, JWT_SECRET, "HS256")
    return c.json({ token })
  }
}

class TaskController {
  static async create(c: any) {
    const user = c.get('jwtPayload')
    const { title, start_time, end_time, priority } = await c.req.json()

    if (priority < 1 || priority > 5) {
      return c.json({ error: 'Priority must be between 1 and 5' }, 400)
    }

    const task = await c.env.DB.prepare(
      'INSERT INTO tasks (title, start_time, end_time, priority, status, user_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
    )
      .bind(title, start_time, end_time, priority, 'pending', user.email)
      .first()

    return c.json(task)
  }

  static async getAll(c: any) {
    const user = c.get('jwtPayload')
    const { priority, status, sort } = c.req.query()

    let query = 'SELECT * FROM tasks WHERE user_id = ?'
    const params = [user.email]

    if (priority) {
      query += ' AND priority = ?'
      params.push(priority)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (sort === 'start_time') {
      query += ' ORDER BY start_time'
    } else if (sort === 'end_time') {
      query += ' ORDER BY end_time'
    }

    const tasks = await c.env.DB.prepare(query)
      .bind(...params)
      .all()

    return c.json(tasks)
  }

  static async update(c: any) {
    const user = c.get('jwtPayload')
    const id = c.req.param('id')
    const { title, start_time, end_time, priority, status } = await c.req.json()

    if (priority && (priority < 1 || priority > 5)) {
      return c.json({ error: 'Priority must be between 1 and 5' }, 400)
    }

    if (status && !['pending', 'finished'].includes(status)) {
      return c.json({ error: 'Status must be pending or finished' }, 400)
    }

    const task = await c.env.DB.prepare(
      'UPDATE tasks SET title = ?, start_time = ?, end_time = ?, priority = ?, status = ? WHERE id = ? AND user_id = ? RETURNING *'
    )
      .bind(title, start_time, end_time, priority, status, id, user.email)
      .first()

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    return c.json(task)
  }

  static async delete(c: any) {
    const user = c.get('jwtPayload')
    const id = c.req.param('id')

    const result = await c.env.DB.prepare(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?'
    )
      .bind(id, user.email)
      .run()

    if (result.changes === 0) {
      return c.json({ error: 'Task not found' }, 404)
    }

    return c.json({ message: 'Task deleted' })
  }

  static async getStats(c: any) {
    const user = c.get('jwtPayload')
    
    const tasks = await c.env.DB.prepare(
      'SELECT * FROM tasks WHERE user_id = ?'
    )
      .bind(user.email)
      .all()
  
    const currentTime = new Date().toISOString()
    
    const totalTasks = tasks.results.length
    const completedTasks = tasks.results.filter((t: any) => t.status === 'finished').length
    const pendingTasks = totalTasks - completedTasks
    
    const timeMetrics = tasks.results.reduce((acc: any, task: any) => {
      const startTime = new Date(task.start_time)
      const endTime = new Date(task.end_time)
      const currentDateTime = new Date(currentTime)
      
      if (task.status === 'finished') {
        const actualTime = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) // in hours
        acc.completedTasksTime.push(actualTime)
      } else {
        const timeLapsed = Math.max(0, (currentDateTime.getTime() - startTime.getTime()) / (1000 * 60 * 60))
        const timeLeft = Math.max(0, (endTime.getTime() - currentDateTime.getTime()) / (1000 * 60 * 60))
        
        acc.pendingTasksMetrics.push({
          priority: task.priority,
          timeLapsed,
          timeLeft: timeLeft > 0 ? timeLeft : 0
        })
      }
      
      return acc
    }, {
      completedTasksTime: [],
      pendingTasksMetrics: []
    })
  
    const priorityMetrics: Record<string, any> = {}
    timeMetrics.pendingTasksMetrics.forEach((task: any) => {
      if (!priorityMetrics[task.priority]) {
        priorityMetrics[task.priority] = {
          totalLapsed: 0,
          totalLeft: 0,
          count: 0
        }
      }
      priorityMetrics[task.priority].totalLapsed += task.timeLapsed
      priorityMetrics[task.priority].totalLeft += task.timeLeft
      priorityMetrics[task.priority].count++
    })
  
    const priorityStats = Object.entries(priorityMetrics).map(([priority, metrics]) => ({
      priority: parseInt(priority),
      avgTimeLapsed: metrics.totalLapsed / metrics.count,
      avgTimeLeft: metrics.totalLeft / metrics.count
    }))
  
    const stats = {
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate: totalTasks ? (completedTasks / totalTasks * 100).toFixed(1) : 0,
      averageCompletionTime: timeMetrics.completedTasksTime.length ? 
        (timeMetrics.completedTasksTime.reduce((a: any, b: any) => a + b, 0) / timeMetrics.completedTasksTime.length).toFixed(1) : 0,
      priorityTimeMetrics: priorityStats,
      message: 'Statistics retrieved successfully'
    }
  
    return c.json(stats)
  }
}

app.post('/auth/login', AuthController.login)
app.post('/tasks', auth, TaskController.create)
app.get('/tasks', auth, TaskController.getAll)
app.put('/tasks/:id', auth, TaskController.update)
app.delete('/tasks/:id', auth, TaskController.delete)
app.get('/tasks/stats', auth, TaskController.getStats)

export default app
