import { useState, useEffect, useRef } from 'react'

// ============ Firebase Config ============
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

let app: any
let db: any

try {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
} catch (error) {
  console.error('Firebase initialization failed:', error)
}

// ============ الأنواع ============
interface Category {
  id: string
  name: string
  icon: string
  image: string
  description: string
  color: string
}

interface OrderForm {
  name: string
  phone: string
  details: string
  files: File[]
}

interface Comment {
  id: string
  oderserId: string
  userName: string
  category: string
  rating: number
  text: string
  date: string
  likes: number
  dislikes: number
  likedBy: string[]
  dislikedBy: string[]
  replies: Reply[]
}

interface Reply {
  id: string
  oderserId: string
  name: string
  text: string
  date: string
  isAdmin?: boolean
}

interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'ai' | 'admin'
  senderName: string
  timestamp: string
}

interface ChatRoom {
  id: string
  oderserId: string
  customerName: string
  messages: ChatMessage[]
  status: 'active' | 'closed'
  createdAt: string
  lastMessage: string
  unreadByAdmin: boolean
}

interface StaffUser {
  email: string
  password: string
  name: string
  role: 'admin' | 'support'
}

// ============ البيانات ============
const categories: Category[] = [
  {
    id: 'powerpoint',
    name: 'عروض PowerPoint',
    icon: '📊',
    image: 'https://img.icons8.com/color/200/microsoft-powerpoint-2019--v1.png',
    description: 'عروض تقديمية احترافية ومميزة',
    color: 'from-orange-400 to-red-500'
  },
  {
    id: 'canva',
    name: 'تصاميم Canva',
    icon: '🎨',
    image: 'https://img.icons8.com/color/200/canva.png',
    description: 'تصاميم سوشيال ميديا إبداعية',
    color: 'from-purple-400 to-pink-500'
  },
  {
    id: 'word',
    name: 'مستندات Word',
    icon: '📝',
    image: 'https://img.icons8.com/color/200/microsoft-word-2019--v1.png',
    description: 'سير ذاتية وتقارير احترافية',
    color: 'from-blue-400 to-blue-600'
  },
  {
    id: 'excel',
    name: 'جداول Excel',
    icon: '📈',
    image: 'https://img.icons8.com/color/200/microsoft-excel-2019--v1.png',
    description: 'جداول بيانات متقدمة ودقيقة',
    color: 'from-green-400 to-green-600'
  },
  {
    id: 'website',
    name: 'برمجة مواقع',
    icon: '</>',
    image: '',
    description: 'مواقع وتطبيقات ويب عصرية',
    color: 'from-gray-600 to-gray-800'
  }
]

const staffUsers: StaffUser[] = [
  {
    email: import.meta.env.VITE_ADMIN_EMAIL || 'admin@ghayn.com',
    password: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123456',
    name: 'محمد',
    role: 'admin'
  }
]

// ============ Google Gemini AI ============
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

async function getAIResponse(userMessage: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return 'خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة لاحقاً.'
  }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `أنت مساعد دعم فني ذكي لمتجر "غين" للمنتجات الرقمية. 
            
خدماتنا:
1. عروض PowerPoint احترافية - تصميم عروض تقديمية مميزة
2. تصاميم Canva - تصاميم سوشيال ميديا وبوسترات
3. مستندات Word - سير ذاتية وتقارير ورسائل رسمية
4. جداول Excel - جداول محاسبية وإحصائية متقدمة
5. برمجة مواقع - تطوير مواقع وتطبيقات ويب

للتواصل: عبر الموقع أو واتساب
طريقة الطلب: اختر المنتج > املأ التفاصيل > أرسل الطلب > نتواصل معك

أجب على سؤال العميل التالي بشكل ودود ومختصر ومفيد باللغة العربية:
${userMessage}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      })
    })

    const data = await response.json()
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text
    }
    return 'شكراً لتواصلك! سيقوم فريق الدعم بالرد عليك قريباً. 🙏'
  } catch (error) {
    console.error('AI Error:', error)
    return 'شكراً لتواصلك! سيقوم فريق الدعم بالرد عليك قريباً. 🙏'
  }
}

// ============ المكون الرئيسي ============
export default function App() {
  // الحالات الأساسية
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: '', phone: '', details: '', files: [] })
  const [showSuccess, setShowSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [activeSection, setActiveSection] = useState('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // التعليقات
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState({ name: '', category: 'powerpoint', rating: 5, text: '' })
  const [showCommentSuccess, setShowCommentSuccess] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyName, setReplyName] = useState('')
  
  // تسجيل الدخول
  const [showLogin, setShowLogin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loggedInUser, setLoggedInUser] = useState<StaffUser | null>(null)
  const [loginError, setLoginError] = useState('')
  
  // الدردشة
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [chatStarted, setChatStarted] = useState(false)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  
  // لوحة الدعم
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [showSupportPanel, setShowSupportPanel] = useState(false)
  const [adminReply, setAdminReply] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [oderserId] = useState(() => localStorage.getItem('oderserId') || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  // حفظ userId
  useEffect(() => {
    localStorage.setItem('oderserId', oderserId)
  }, [oderserId])

  // استرجاع بيانات المستخدم
  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser')
    if (savedUser) {
      setLoggedInUser(JSON.parse(savedUser))
    }
    
    // استرجاع حالة الدردشة
    const savedRoomId = localStorage.getItem('currentRoomId')
    const savedCustomerName = localStorage.getItem('customerName')
    if (savedRoomId && savedCustomerName) {
      setCurrentRoomId(savedRoomId)
      setCustomerName(savedCustomerName)
      setChatStarted(true)
    }
  }, [])

  // التمرير لأسفل الدردشة
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // جلب التعليقات من Firebase
  useEffect(() => {
    try {
      const q = query(collection(db, 'comments'), orderBy('date', 'desc'))
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData: Comment[] = []
        snapshot.forEach((docSnap) => {
          commentsData.push({ id: docSnap.id, ...docSnap.data() } as Comment)
        })
        setComments(commentsData)
      }, (error) => {
        console.error('Firebase comments error:', error)
      })
      return () => unsubscribe()
    } catch (error) {
      console.error('Firebase init error:', error)
    }
  }, [])

  // جلب غرف الدردشة للمسؤولين
  useEffect(() => {
    if (loggedInUser) {
      try {
        const q = query(collection(db, 'chatRooms'), orderBy('createdAt', 'desc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const rooms: ChatRoom[] = []
          let unread = 0
          snapshot.forEach((doc) => {
            const room = { id: doc.id, ...doc.data() } as ChatRoom
            rooms.push(room)
            if (room.unreadByAdmin && room.status === 'active') {
              unread++
            }
          })
          setChatRooms(rooms)
          setUnreadCount(unread)
          
          // إشعار للمسؤول
          if (unread > 0 && !showSupportPanel) {
            setNotificationMessage(`لديك ${unread} محادثة جديدة تنتظر الرد`)
            setShowNotification(true)
            setTimeout(() => setShowNotification(false), 5000)
          }
        }, (error) => {
          console.error('Firebase rooms error:', error)
        })
        return () => unsubscribe()
      } catch (error) {
        console.error('Firebase init error:', error)
      }
    }
  }, [loggedInUser, showSupportPanel])

  // جلب رسائل الدردشة للعميل
  useEffect(() => {
    if (currentRoomId && chatStarted) {
      try {
        const unsubscribe = onSnapshot(doc(db, 'chatRooms', currentRoomId), (docSnap) => {
          if (docSnap.exists()) {
            const roomData = docSnap.data() as ChatRoom
            setChatMessages(roomData.messages || [])
          }
        }, (error) => {
          console.error('Firebase chat error:', error)
        })
        return () => unsubscribe()
      } catch (error) {
        console.error('Firebase init error:', error)
      }
    }
  }, [currentRoomId, chatStarted])

  // تحديث غرفة الدردشة المحددة
  useEffect(() => {
    if (selectedRoom) {
      try {
        const unsubscribe = onSnapshot(doc(db, 'chatRooms', selectedRoom.id), (docSnap) => {
          if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as ChatRoom
            setSelectedRoom(roomData)
          }
        }, (error) => {
          console.error('Firebase selected room error:', error)
        })
        return () => unsubscribe()
      } catch (error) {
        console.error('Firebase init error:', error)
      }
    }
  }, [selectedRoom?.id])

  // إرسال الطلب
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory) return

    const newOrderNumber = `GH${Date.now().toString().slice(-8)}`
    setOrderNumber(newOrderNumber)

    try {
      const emailParams = {
        order_number: newOrderNumber,
        customer_name: orderForm.name,
        customer_phone: orderForm.phone,
        category: selectedCategory.name,
        order_details: orderForm.details,
        attachments: orderForm.files.map(f => f.name).join(', ') || 'لا يوجد'
      }

      const emailJsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || ''
      const emailJsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
      const emailJsUserId = import.meta.env.VITE_EMAILJS_USER_ID || ''

      if (emailJsServiceId && emailJsTemplateId && emailJsUserId) {
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailJsServiceId,
            template_id: emailJsTemplateId,
            user_id: emailJsUserId,
            template_params: emailParams
          })
        })
      }
    } catch (error) {
      console.error('Email error:', error)
    }

    setShowSuccess(true)
    setOrderForm({ name: '', phone: '', details: '', files: [] })
    setTimeout(() => {
      setShowSuccess(false)
      setSelectedCategory(null)
    }, 7000)
  }

  // إضافة تعليق
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const comment = {
      userName: newComment.name,
      category: newComment.category,
      rating: newComment.rating,
      text: newComment.text,
      date: new Date().toISOString(),
      oderserId: oderserId,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      replies: []
    }

    try {
      await addDoc(collection(db, 'comments'), comment)
      setNewComment({ name: '', category: 'powerpoint', rating: 5, text: '' })
      setShowCommentSuccess(true)
      setTimeout(() => setShowCommentSuccess(false), 3000)
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('حدث خطأ في إضافة التعليق. يرجى المحاولة مرة أخرى.')
    }
  }

  // حذف تعليق (للمالك أو المسؤول فقط)
  const handleDeleteComment = async (commentId: string, commentOderserId: string) => {
    const isOwner = commentOderserId === oderserId
    const isAdmin = loggedInUser?.role === 'admin'
    
    if (!isOwner && !isAdmin) {
      alert('لا يمكنك حذف هذا التعليق')
      return
    }

    if (confirm('هل أنت متأكد من حذف هذا التعليق؟')) {
      try {
        await deleteDoc(doc(db, 'comments', commentId))
      } catch (error) {
        console.error('Error deleting comment:', error)
      }
    }
  }

  // تقييم التعليق
  const handleLike = async (commentId: string, isLike: boolean) => {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const likedBy = comment.likedBy || []
    const dislikedBy = comment.dislikedBy || []

    let newLikes = comment.likes
    let newDislikes = comment.dislikes
    let newLikedBy = [...likedBy]
    let newDislikedBy = [...dislikedBy]

    if (isLike) {
      if (likedBy.includes(oderserId)) {
        newLikes--
        newLikedBy = newLikedBy.filter(id => id !== oderserId)
      } else {
        newLikes++
        newLikedBy.push(oderserId)
        if (dislikedBy.includes(oderserId)) {
          newDislikes--
          newDislikedBy = newDislikedBy.filter(id => id !== oderserId)
        }
      }
    } else {
      if (dislikedBy.includes(oderserId)) {
        newDislikes--
        newDislikedBy = newDislikedBy.filter(id => id !== oderserId)
      } else {
        newDislikes++
        newDislikedBy.push(oderserId)
        if (likedBy.includes(oderserId)) {
          newLikes--
          newLikedBy = newLikedBy.filter(id => id !== oderserId)
        }
      }
    }

    try {
      await updateDoc(doc(db, 'comments', commentId), {
        likes: newLikes,
        dislikes: newDislikes,
        likedBy: newLikedBy,
        dislikedBy: newDislikedBy
      })
    } catch (error) {
      console.error('Error updating like:', error)
    }
  }

  // إضافة رد
  const handleAddReply = async (commentId: string) => {
    if (!replyText.trim() || !replyName.trim()) return

    const reply: Reply = {
      id: `reply_${Date.now()}`,
      oderserId: oderserId,
      name: loggedInUser ? `${loggedInUser.name} (فريق الدعم)` : replyName,
      text: replyText,
      date: new Date().toISOString(),
      isAdmin: !!loggedInUser
    }

    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const newReplies = [...(comment.replies || []), reply]

    try {
      await updateDoc(doc(db, 'comments', commentId), { replies: newReplies })
    } catch (error) {
      console.error('Error adding reply:', error)
    }

    setReplyingTo(null)
    setReplyText('')
    setReplyName('')
  }

  // تسجيل الدخول
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const user = staffUsers.find(u => u.email === loginEmail && u.password === loginPassword)
    if (user) {
      setLoggedInUser(user)
      localStorage.setItem('loggedInUser', JSON.stringify(user))
      setShowLogin(false)
      setLoginEmail('')
      setLoginPassword('')
      setLoginError('')
    } else {
      setLoginError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    }
  }

  // تسجيل الخروج
  const handleLogout = () => {
    setLoggedInUser(null)
    localStorage.removeItem('loggedInUser')
    setShowSupportPanel(false)
  }

  // بدء الدردشة
  const startChat = async () => {
    if (!customerName.trim()) return
    setChatStarted(true)
    
    const welcomeMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: `أهلاً وسهلاً ${customerName}! 👋\n\nأنا المساعد الذكي لمتجر غين. كيف يمكنني مساعدتك اليوم؟`,
      sender: 'ai',
      senderName: 'المساعد الذكي',
      timestamp: new Date().toISOString()
    }
    setChatMessages([welcomeMsg])

    try {
      const roomRef = await addDoc(collection(db, 'chatRooms'), {
        oderserId,
        customerName,
        messages: [welcomeMsg],
        status: 'active',
        createdAt: new Date().toISOString(),
        lastMessage: welcomeMsg.text,
        unreadByAdmin: true
      })
      setCurrentRoomId(roomRef.id)
      localStorage.setItem('currentRoomId', roomRef.id)
      localStorage.setItem('customerName', customerName)
    } catch (error) {
      console.error('Error creating chat room:', error)
    }
  }

  // إرسال رسالة في الدردشة
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentRoomId) return

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: chatInput,
      sender: 'user',
      senderName: customerName,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...chatMessages, userMsg]
    setChatMessages(updatedMessages)
    setChatInput('')
    setIsAiTyping(true)

    try {
      await updateDoc(doc(db, 'chatRooms', currentRoomId), {
        messages: updatedMessages,
        lastMessage: chatInput,
        unreadByAdmin: true
      })
    } catch (error) {
      console.error('Error sending message:', error)
    }

    // الحصول على رد AI
    const aiResponse = await getAIResponse(chatInput)
    
    const aiMsg: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      text: aiResponse,
      sender: 'ai',
      senderName: 'المساعد الذكي',
      timestamp: new Date().toISOString()
    }

    const finalMessages = [...updatedMessages, aiMsg]
    setChatMessages(finalMessages)
    setIsAiTyping(false)

    try {
      await updateDoc(doc(db, 'chatRooms', currentRoomId), {
        messages: finalMessages,
        lastMessage: aiResponse
      })
    } catch (error) {
      console.error('Error saving AI response:', error)
    }
  }

  // رد المسؤول
  const sendAdminReply = async () => {
    if (!adminReply.trim() || !selectedRoom) return

    const adminMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      text: adminReply,
      sender: 'admin',
      senderName: `${loggedInUser?.name} (فريق الدعم)`,
      timestamp: new Date().toISOString()
    }

    try {
      const newMessages = [...selectedRoom.messages, adminMsg]
      await updateDoc(doc(db, 'chatRooms', selectedRoom.id), {
        messages: newMessages,
        lastMessage: adminReply,
        unreadByAdmin: false
      })
    } catch (error) {
      console.error('Error sending admin reply:', error)
    }

    setAdminReply('')
  }

  // فتح غرفة الدردشة وتحديدها كمقروءة
  const openRoom = async (room: ChatRoom) => {
    setSelectedRoom(room)
    if (room.unreadByAdmin) {
      try {
        await updateDoc(doc(db, 'chatRooms', room.id), { unreadByAdmin: false })
      } catch (error) {
        console.error('Error marking as read:', error)
      }
    }
  }

  // إغلاق غرفة الدعم
  const closeRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, 'chatRooms', roomId), { status: 'closed' as const })
    } catch (error) {
      console.error('Error closing room:', error)
    }
  }

  // حذف غرفة الدعم
  const deleteRoom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المحادثة؟')) return
    try {
      await deleteDoc(doc(db, 'chatRooms', roomId))
      setSelectedRoom(null)
    } catch (error) {
      console.error('Error deleting room:', error)
    }
  }

  // إنهاء الدردشة للعميل
  const endChat = () => {
    setChatStarted(false)
    setChatMessages([])
    setCustomerName('')
    setCurrentRoomId(null)
    localStorage.removeItem('currentRoomId')
    localStorage.removeItem('customerName')
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* إشعار للمسؤول */}
      {showNotification && loggedInUser && (
        <div className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-xl shadow-2xl z-[100] animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-bold">محادثة جديدة!</p>
              <p className="text-sm opacity-90">{notificationMessage}</p>
            </div>
            <button onClick={() => setShowNotification(false)} className="mr-auto text-white/80 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* Header - تصميم عصري مثل سلة */}
      <header className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* الشعار */}
            <div className="flex items-center gap-3">
              <img src="https://i.imgur.com/cXHH333.png" alt="غين" className="w-10 h-10 rounded-xl shadow-md" />
              <h1 className="text-2xl font-bold bg-gradient-to-l from-gray-300 via-white to-gray-400 bg-clip-text text-transparent drop-shadow-lg" style={{textShadow: '0 0 20px rgba(192,192,192,0.5), 0 0 40px rgba(192,192,192,0.3)'}}>غين</h1>
            </div>

            {/* القائمة - Desktop */}
            <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => setActiveSection('home')} 
                className={`font-medium transition hover:text-gray-900 ${activeSection === 'home' ? 'text-gray-900' : 'text-gray-500'}`}
              >
                الرئيسية
              </button>
              <button 
                onClick={() => setActiveSection('products')} 
                className={`font-medium transition hover:text-gray-900 ${activeSection === 'products' ? 'text-gray-900' : 'text-gray-500'}`}
              >
                المنتجات
              </button>
              <button 
                onClick={() => setActiveSection('comments')} 
                className={`font-medium transition hover:text-gray-900 ${activeSection === 'comments' ? 'text-gray-900' : 'text-gray-500'}`}
              >
                التعليقات
              </button>
              <button 
                onClick={() => setShowChat(true)} 
                className="flex items-center gap-2 bg-gradient-to-l from-gray-700 to-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition"
              >
                <span>💬</span>
                تواصل معنا
              </button>
            </nav>

            {/* أزرار المستخدم */}
            <div className="flex items-center gap-3">
              {loggedInUser ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSupportPanel(true)}
                    className="relative bg-gradient-to-l from-emerald-500 to-green-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition flex items-center gap-2"
                  >
                    <span>📬</span>
                    <span className="hidden md:inline">صندوق الوارد</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-2 -left-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <div className="hidden md:flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-2 rounded-xl">
                    <span>👑</span>
                    <span className="font-medium">{loggedInUser.name}</span>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="bg-red-100 text-red-600 px-3 py-2 rounded-xl hover:bg-red-200 transition"
                  >
                    خروج
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  تسجيل دخول
                </button>
              )}

              {/* زر القائمة للموبايل */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden bg-gray-100 p-2 rounded-xl"
              >
                <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>

          {/* القائمة - Mobile */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t space-y-2">
              <button 
                onClick={() => { setActiveSection('home'); setMobileMenuOpen(false); }} 
                className="block w-full text-right px-4 py-2 rounded-xl hover:bg-gray-100"
              >
                الرئيسية
              </button>
              <button 
                onClick={() => { setActiveSection('products'); setMobileMenuOpen(false); }} 
                className="block w-full text-right px-4 py-2 rounded-xl hover:bg-gray-100"
              >
                المنتجات
              </button>
              <button 
                onClick={() => { setActiveSection('comments'); setMobileMenuOpen(false); }} 
                className="block w-full text-right px-4 py-2 rounded-xl hover:bg-gray-100"
              >
                التعليقات
              </button>
              <button 
                onClick={() => { setShowChat(true); setMobileMenuOpen(false); }} 
                className="block w-full text-right px-4 py-2 rounded-xl bg-gray-900 text-white"
              >
                💬 تواصل معنا
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section - تصميم عصري */}
      {activeSection === 'home' && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative container mx-auto px-4 py-24 text-center">
            <div className="inline-block mb-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm">
              ✨ منتجات رقمية احترافية
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
              مرحباً بك في <span className="bg-gradient-to-l from-gray-200 via-white to-gray-300 bg-clip-text text-transparent" style={{textShadow: '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(192,192,192,0.5)'}}>غين</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              نقدم لك أفضل المنتجات الرقمية من عروض تقديمية وتصاميم ومستندات احترافية
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setActiveSection('products')}
                className="bg-white text-gray-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-xl hover:shadow-2xl transition transform hover:-translate-y-1"
              >
                تصفح المنتجات
              </button>
              <button
                onClick={() => setShowChat(true)}
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-white/20 transition"
              >
                💬 تواصل معنا
              </button>
            </div>

            {/* إحصائيات */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {[
                { num: '+25', label: 'مشروع منجز' },
                { num: '+20', label: 'عميل سعيد' },
                { num: '24/7', label: 'دعم فني' },
                { num: '100%', label: 'رضا العملاء' }
              ].map((stat, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <p className="text-3xl font-bold text-white">{stat.num}</p>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Section - تصميم عصري */}
      {(activeSection === 'home' || activeSection === 'products') && (
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">خدماتنا</h2>
              <p className="text-gray-600 max-w-xl mx-auto">نقدم لك مجموعة متنوعة من المنتجات الرقمية الاحترافية</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories.map(category => (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className="group bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
                >
                  <div className={`h-48 bg-gradient-to-br ${category.color} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition"></div>
                    {category.image ? (
                      <img src={category.image} alt={category.name} className="h-28 w-28 object-contain drop-shadow-xl group-hover:scale-110 transition" />
                    ) : (
                      <span className="text-7xl font-mono text-white drop-shadow-xl">{category.icon}</span>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{category.name}</h3>
                    <p className="text-gray-600 mb-4">{category.description}</p>
                    <button className={`w-full bg-gradient-to-l ${category.color} text-white py-3 rounded-xl font-medium group-hover:shadow-lg transition`}>
                      اطلب الآن
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Comments Section - تصميم عصري */}
      {(activeSection === 'home' || activeSection === 'comments') && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">آراء عملائنا</h2>
              <p className="text-gray-600 max-w-xl mx-auto">نفخر بثقة عملائنا ورضاهم عن خدماتنا</p>
            </div>

            {/* نموذج إضافة تعليق */}
            <div className="max-w-2xl mx-auto bg-gray-50 rounded-3xl p-8 mb-12">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>✍️</span>
                شاركنا رأيك
              </h3>
              
              {showCommentSuccess && (
                <div className="bg-green-100 text-green-700 p-4 rounded-2xl mb-6 flex items-center gap-3 animate-pulse">
                  <span className="text-2xl">✅</span>
                  <span className="font-medium">شكراً على تعليقك! سيظهر للجميع.</span>
                </div>
              )}

              <form onSubmit={handleAddComment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="اسمك"
                    value={newComment.name}
                    onChange={e => setNewComment({ ...newComment, name: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                    required
                  />
                  <select
                    value={newComment.category}
                    onChange={e => setNewComment({ ...newComment, category: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-gray-200">
                  <span className="text-gray-600 font-medium">التقييم:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewComment({ ...newComment, rating: star })}
                        className={`text-3xl transition transform hover:scale-110 ${star <= newComment.rating ? 'text-amber-400' : 'text-gray-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="اكتب تعليقك هنا..."
                  value={newComment.text}
                  onChange={e => setNewComment({ ...newComment, text: e.target.value })}
                  className="w-full p-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition h-32 resize-none"
                  required
                />

                <button
                  type="submit"
                  className="w-full bg-gradient-to-l from-gray-700 to-gray-900 text-white py-4 rounded-2xl font-bold hover:shadow-xl transition transform hover:-translate-y-0.5"
                >
                  إرسال التعليق
                </button>
              </form>
            </div>

            {/* عرض التعليقات */}
            <div className="max-w-4xl mx-auto space-y-6">
              {comments.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-3xl">
                  <span className="text-6xl mb-4 block">💬</span>
                  <p className="text-xl text-gray-600">لا توجد تعليقات بعد</p>
                  <p className="text-gray-500">كن أول من يشارك رأيه!</p>
                </div>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="bg-gray-50 rounded-3xl p-6 hover:shadow-lg transition">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
                        {comment.userName?.charAt(0) || '؟'}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-bold text-gray-900">{comment.userName}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-lg">
                            {categories.find(c => c.id === comment.category)?.name}
                          </span>
                          <div className="flex gap-0.5 mr-auto">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={`text-sm ${star <= comment.rating ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-4 leading-relaxed">{comment.text}</p>

                        {/* أزرار التفاعل */}
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleLike(comment.id, true)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                              comment.likedBy?.includes(oderserId)
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <span>👍</span>
                            <span>{comment.likes || 0}</span>
                          </button>
                          <button
                            onClick={() => handleLike(comment.id, false)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                              comment.dislikedBy?.includes(oderserId)
                                ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <span>👎</span>
                            <span>{comment.dislikes || 0}</span>
                          </button>
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                          >
                            <span>💬</span>
                            <span>رد</span>
                          </button>
                          
                          {/* زر الحذف للمالك أو المسؤول */}
                          {(comment.oderserId === oderserId || loggedInUser?.role === 'admin') && (
                            <button
                              onClick={() => handleDeleteComment(comment.id, comment.oderserId)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition mr-auto"
                            >
                              <span>🗑️</span>
                              <span>حذف</span>
                            </button>
                          )}
                        </div>

                        {/* نموذج الرد */}
                        {replyingTo === comment.id && (
                          <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-gray-200">
                            {!loggedInUser && (
                              <input
                                type="text"
                                placeholder="اسمك"
                                value={replyName}
                                onChange={e => setReplyName(e.target.value)}
                                className="w-full p-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-gray-400 focus:outline-none"
                              />
                            )}
                            <textarea
                              placeholder="اكتب ردك..."
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              className="w-full p-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-gray-400 focus:outline-none h-20 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddReply(comment.id)}
                                className="bg-gray-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-gray-800 transition"
                              >
                                إرسال
                              </button>
                              <button
                                onClick={() => setReplyingTo(null)}
                                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl font-medium hover:bg-gray-300 transition"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}

                        {/* عرض الردود */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-4 space-y-3 pr-4 border-r-4 border-gray-200">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className={`p-4 rounded-2xl ${reply.isAdmin ? 'bg-green-50 border-2 border-green-200' : 'bg-white'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`font-bold text-sm ${reply.isAdmin ? 'text-green-700' : 'text-gray-700'}`}>
                                    {reply.isAdmin && '✓ '}{reply.name}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(reply.date).toLocaleDateString('ar-SA')}
                                  </span>
                                </div>
                                <p className="text-gray-600 text-sm">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer - تصميم عصري */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="https://i.imgur.com/cXHH333.png" alt="غين" className="w-12 h-12 rounded-xl" />
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-l from-gray-300 via-white to-gray-400 bg-clip-text text-transparent" style={{textShadow: '0 0 20px rgba(192,192,192,0.5)'}}>غين</h3>
                <p className="text-gray-400 text-sm">متجر المنتجات الرقمية</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => setActiveSection('home')} className="text-gray-400 hover:text-white transition">الرئيسية</button>
              <button onClick={() => setActiveSection('products')} className="text-gray-400 hover:text-white transition">المنتجات</button>
              <button onClick={() => setActiveSection('comments')} className="text-gray-400 hover:text-white transition">التعليقات</button>
              <button onClick={() => setShowChat(true)} className="text-gray-400 hover:text-white transition">تواصل معنا</button>
            </div>
          </div>
          <hr className="my-8 border-gray-800" />
          <p className="text-center text-gray-500">حقوق الطبع و النشر لدى متجر غين 2026©</p>
        </div>
      </footer>

      {/* Order Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {showSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-green-600 mb-4">تم إرسال طلبك بنجاح!</h3>
                <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-right">
                  <p className="text-gray-600 mb-2">📋 رقم الطلب: <span className="font-bold text-gray-900">{orderNumber}</span></p>
                  <p className="text-gray-600 mb-2">📱 الرجاء الانتباه على إشعارات الواتساب أو الاتصالات عبر الهاتف.</p>
                  <p className="text-gray-600">⏰ سيتم الرد عليك في أسرع وقت.</p>
                </div>
                <button
                  onClick={() => { setShowSuccess(false); setSelectedCategory(null); }}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-gray-800 transition"
                >
                  حسناً
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 border-b flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedCategory.image ? (
                      <img src={selectedCategory.image} alt="" className="w-14 h-14 object-contain" />
                    ) : (
                      <span className="text-4xl">{selectedCategory.icon}</span>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h3>
                      <p className="text-gray-500 text-sm">{selectedCategory.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">الاسم الكامل *</label>
                    <input
                      type="text"
                      value={orderForm.name}
                      onChange={e => setOrderForm({ ...orderForm, name: e.target.value })}
                      className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                      placeholder="أدخل اسمك الكامل"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">رقم الهاتف *</label>
                    <input
                      type="tel"
                      value={orderForm.phone}
                      onChange={e => setOrderForm({ ...orderForm, phone: e.target.value })}
                      className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                      placeholder="05xxxxxxxx"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">تفاصيل الطلب *</label>
                    <textarea
                      value={orderForm.details}
                      onChange={e => setOrderForm({ ...orderForm, details: e.target.value })}
                      className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition h-32 resize-none"
                      placeholder="اكتب جميع التفاصيل التي تريدها..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">إرفاق صور أو أمثلة (اختياري)</label>
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-gray-400 transition cursor-pointer">
                      <input
                        type="file"
                        multiple
                        onChange={e => setOrderForm({ ...orderForm, files: Array.from(e.target.files || []) })}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="text-3xl block mb-2">📎</span>
                        <span className="text-gray-500">اضغط لاختيار الملفات</span>
                      </label>
                      {orderForm.files.length > 0 && (
                        <p className="mt-2 text-green-600 text-sm">تم اختيار {orderForm.files.length} ملف</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={`w-full bg-gradient-to-l ${selectedCategory.color} text-white py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition transform hover:-translate-y-0.5`}
                  >
                    إرسال الطلب
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">تسجيل الدخول</h3>
              <p className="text-gray-500">للموظفين والمسؤولين فقط</p>
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-2">
                <span>⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                  placeholder="example@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">كلمة المرور</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition"
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 left-6 bg-gradient-to-l from-gray-700 to-gray-900 text-white w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center text-2xl hover:shadow-3xl transition transform hover:scale-110 z-40"
      >
        💬
      </button>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed bottom-24 left-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-3xl shadow-2xl z-50 overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-l from-gray-700 to-gray-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
              <div>
                <p className="font-bold">تواصل معنا</p>
                <p className="text-xs text-gray-300">نرد عليك فوراً</p>
              </div>
            </div>
            <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition">✕</button>
          </div>

          {!chatStarted ? (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">👋</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-1">مرحباً بك!</h4>
                <p className="text-gray-500 text-sm">أدخل اسمك لبدء المحادثة</p>
              </div>
              <input
                type="text"
                placeholder="اسمك الكريم"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-gray-400 focus:outline-none transition mb-4"
              />
              <button
                onClick={startChat}
                disabled={!customerName.trim()}
                className="w-full bg-gradient-to-l from-gray-700 to-gray-900 text-white py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition"
              >
                بدء المحادثة
              </button>
            </div>
          ) : (
            <>
              <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl ${
                        msg.sender === 'user'
                          ? 'bg-gray-900 text-white rounded-br-none'
                          : msg.sender === 'admin'
                          ? 'bg-green-500 text-white rounded-bl-none'
                          : 'bg-white text-gray-800 rounded-bl-none shadow-md'
                      }`}
                    >
                      <p className={`text-xs mb-1 ${msg.sender === 'user' ? 'text-gray-300' : msg.sender === 'admin' ? 'text-green-100' : 'text-gray-500'}`}>
                        {msg.senderName}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-800 p-4 rounded-2xl rounded-bl-none shadow-md">
                      <p className="text-xs text-gray-500 mb-1">المساعد الذكي</p>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اكتب رسالتك..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                    className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-gray-400 focus:outline-none transition"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim()}
                    className="bg-gray-900 text-white px-4 rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    ➤
                  </button>
                </div>
                <button
                  onClick={endChat}
                  className="w-full mt-3 text-red-500 text-sm hover:underline"
                >
                  إنهاء المحادثة
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Support Panel for Admin */}
      {showSupportPanel && loggedInUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex">
            {/* قائمة المحادثات */}
            <div className="w-1/3 border-l bg-gray-50 flex flex-col">
              <div className="p-4 border-b bg-gradient-to-l from-gray-700 to-gray-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📬</span>
                  <h3 className="font-bold">صندوق الوارد</h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{unreadCount}</span>
                  )}
                </div>
                <button onClick={() => setShowSupportPanel(false)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatRooms.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl block mb-2">📭</span>
                    <p>لا توجد محادثات</p>
                  </div>
                ) : (
                  chatRooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-100 transition ${
                        selectedRoom?.id === room.id ? 'bg-gray-200' : ''
                      } ${room.unreadByAdmin ? 'bg-green-50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{room.customerName}</span>
                          {room.unreadByAdmin && (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          room.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {room.status === 'active' ? 'نشط' : 'مغلق'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{room.lastMessage}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(room.createdAt).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* محتوى المحادثة */}
            <div className="flex-1 flex flex-col bg-gray-50">
              {selectedRoom ? (
                <>
                  <div className="p-4 border-b bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-lg">
                        {selectedRoom.customerName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedRoom.customerName}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(selectedRoom.createdAt).toLocaleString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedRoom.status === 'active' && (
                        <button
                          onClick={() => closeRoom(selectedRoom.id)}
                          className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-200 transition"
                        >
                          إغلاق
                        </button>
                      )}
                      {loggedInUser.role === 'admin' && (
                        <button
                          onClick={() => deleteRoom(selectedRoom.id)}
                          className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-200 transition"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedRoom.messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-4 rounded-2xl ${
                            msg.sender === 'user'
                              ? 'bg-gray-900 text-white rounded-br-none'
                              : msg.sender === 'admin'
                              ? 'bg-green-500 text-white rounded-bl-none'
                              : 'bg-white text-gray-800 rounded-bl-none shadow-md'
                          }`}
                        >
                          <p className={`text-xs mb-1 ${msg.sender === 'user' ? 'text-gray-300' : msg.sender === 'admin' ? 'text-green-100' : 'text-gray-500'}`}>
                            {msg.senderName}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedRoom.status === 'active' && (
                    <div className="p-4 border-t bg-white flex gap-2">
                      <input
                        type="text"
                        placeholder="اكتب ردك..."
                        value={adminReply}
                        onChange={e => setAdminReply(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendAdminReply()}
                        className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-gray-400 focus:outline-none transition"
                      />
                      <button
                        onClick={sendAdminReply}
                        disabled={!adminReply.trim()}
                        className="bg-green-500 text-white px-6 rounded-xl hover:bg-green-600 transition font-medium disabled:opacity-50"
                      >
                        إرسال
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <span className="text-6xl mb-4">💬</span>
                  <p className="text-xl font-medium">اختر محادثة لعرضها</p>
                  <p className="text-sm">المحادثات الجديدة ستظهر هنا</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
