import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  Layers, 
  ShieldCheck, 
  Trash2, 
  Plus, 
  Printer, 
  Save, 
  Search, 
  Building, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  HelpCircle, 
  FileText, 
  Check, 
  Download,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Pen,
  ExternalLink,
  FolderOpen
} from 'lucide-react';

// แปลงลิงก์ Google Drive แชร์เพื่อใช้แสดงผลในภาพ ให้เสถียรและทนทานหลบเลี่ยงบล็อกสิทธิ์
export function getGoogleDrivePreviewUrl(url: string): string {
  if (!url) return '';
  let fileId = '';
  const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    fileId = matchD[1];
  } else {
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      fileId = matchId[1];
    }
  }
  if (fileId) {
    // ใช้บริการ lh3.googleusercontent.com หรือ thumbnail สำหรับการดึงรูปภาพโดยไม่ต้องใช้ Cookies ของเซสชันเบส
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
}

// ประกาศประเภทข้อมูล
interface ShieldItem {
  id: string;
  name: string;
  condition: string;
  crackCheck: string;
  imageLink: string;
  imageBase64: string;
}

interface QCRecord {
  id: string;
  timestamp: string;
  surveyorName: string;
  chiefName: string;
  items: { [key: string]: string };
  sidValue: number;
  errorX: number;
  errorY: number;
  collimatorResult: boolean;
  shields: ShieldItem[];
  sigSurveyor: string;
  sigChief: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'report'>('form');
  const [selectedReportRecord, setSelectedReportRecord] = useState<QCRecord | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);
  
  // ข้อมูลบุคลากร
  const [surveyorName, setSurveyorName] = useState('');
  const [chiefName, setChiefName] = useState('');
  
  // แบบบันทึก F4 (7 รายการ)
  const [checklist, setChecklist] = useState<{ [key: string]: 'ปกติ' | 'ชำรุด' }>({
    item1: 'ปกติ',
    item2: 'ปกติ',
    item3: 'ปกติ',
    item4: 'ปกติ',
    item5: 'ปกติ',
    item6: 'ปกติ',
    item7: 'ปกติ',
  });
  
  const checklistLabels: { [key: string]: string } = {
    item1: '1. ความมั่นคงของฐานเครื่อง',
    item2: '2. การทำงานของตัวเบรกเคลื่อนที่',
    item3: '3. ความเที่ยงตรงของตัวชี้วัดมุม',
    item4: '4. ความขนานของพื้นผิวเตียง',
    item5: '5. การทำงานของสลักล็อกถาด Bucky',
    item6: '6. ความตึงของสายเคเบิล',
    item7: '7. ปุ่มหยุดฉุกเฉิน (Emergency Stop)',
  };

  // การตรวจ Collimator
  const [sidValue, setSidValue] = useState<number>(100);
  const [errorX, setErrorX] = useState<number>(1.2);
  const [errorY, setErrorY] = useState<number>(0.8);

  // คำนวณขีดจำกัดความคลาดเคลื่อน (2% ของ SID)
  const allowedLimit = parseFloat((sidValue * 0.02).toFixed(2));
  const isCollimatorPass = (errorX <= allowedLimit) && (errorY <= allowedLimit);

  // อุปกรณ์ป้องกันรังสีแบบ Dynamic
  const [shields, setShields] = useState<ShieldItem[]>([
    {
      id: 'shield_initial_1',
      name: 'เสื้อตะกั่วป้องกันรังสี (Lead Apron) #042',
      condition: 'สมบูรณ์ดี',
      crackCheck: 'ไม่มีรอยแตก',
      imageLink: '',
      imageBase64: ''
    },
    {
      id: 'shield_initial_2',
      name: 'ปลอกคอกันรังสี (Thyroid Shield) #01',
      condition: 'สมบูรณ์ดี',
      crackCheck: 'ไม่มีรอยแตก',
      imageLink: '',
      imageBase64: ''
    }
  ]);

  // ประวัติการบันทึกข้อมูล (ดึงมาและเก็บไว้ใน localStorage)
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // โหลดข้อมูลเก่าจาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rt_qc_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load past records", e);
      }
    }
  }, []);

  // การลงคู่ลายเซ็น Canvas Refs
  const canvasSurveyorRef = useRef<HTMLCanvasElement | null>(null);
  const canvasChiefRef = useRef<HTMLCanvasElement | null>(null);
  const [isSurveyorSigned, setIsSurveyorSigned] = useState(false);
  const [isChiefSigned, setIsChiefSigned] = useState(false);
  const [surveyorSignatureDataUrl, setSurveyorSignatureDataUrl] = useState<string>('');
  const [chiefSignatureDataUrl, setChiefSignatureDataUrl] = useState<string>('');
  const [showGasGuide, setShowGasGuide] = useState(false);

  // ติดตั้ง Event ลากเส้น วาดใน Canvas
  const setupCanvasDrawing = (
    canvas: HTMLCanvasElement | null, 
    onChangeState: (val: boolean) => void,
    role: 'surveyor' | 'chief'
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // เคลียร์และปรับสเกลขนาดหน้าจอวาด
    const scaleCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height || 140;
        ctx.strokeStyle = "#1e3a8a"; // สีกรมท่า
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // โหลดลายเซ็นและวาดคืนรูปหากเก็บสะสมไว้ใน state เพื่อเลี่ยงการสูญหายขณะสลับแท็บ
        const existingDataUrl = role === 'surveyor' ? surveyorSignatureDataUrl : chiefSignatureDataUrl;
        if (existingDataUrl) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = existingDataUrl;
          onChangeState(true);
        }
      }
    };
    scaleCanvas();

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const startDraw = (x: number, y: number) => {
      isDrawing = true;
      lastX = x;
      lastY = y;
      onChangeState(true);
    };

    const draw = (x: number, y: number) => {
      if (!isDrawing) return;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
    };

    const saveToState = () => {
      try {
        const dataUrl = canvas.toDataURL();
        if (role === 'surveyor') {
          setSurveyorSignatureDataUrl(dataUrl);
        } else {
          setChiefSignatureDataUrl(dataUrl);
        }
      } catch (e) {
        console.error("Failed to save draft signature state", e);
      }
    };

    const stopDraw = () => {
      if (isDrawing) {
        isDrawing = false;
        saveToState();
      }
    };

    // ลวดลาย Mouse Events
    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      startDraw(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      draw(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.onmouseup = stopDraw;
    canvas.onmouseleave = stopDraw;

    // ทัชสกรีน มือถือ/แท็บเล็ต
    canvas.ontouchstart = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        startDraw(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    };
    canvas.ontouchmove = (e) => {
      if (e.touches.length > 0 && isDrawing) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        draw(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    };
    canvas.ontouchend = stopDraw;
    canvas.ontouchcancel = stopDraw;
  };

  useEffect(() => {
    // ให้สแตนด์บายวาดใหม่ทุกครั้งที่แท็บ 'form' แอคทีฟอีกครั้ง
    if (activeTab === 'form') {
      setTimeout(() => {
        setupCanvasDrawing(canvasSurveyorRef.current, setIsSurveyorSigned, 'surveyor');
        setupCanvasDrawing(canvasChiefRef.current, setIsChiefSigned, 'chief');
      }, 50); // ดีเลย์สั้นเพื่อรอให้ DOM เรนเดอร์เสร็จสมบูรณ์
    }
  }, [activeTab]);

  const clearCanvas = (role: 'surveyor' | 'chief') => {
    const canvas = role === 'surveyor' ? canvasSurveyorRef.current : canvasChiefRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    if (role === 'surveyor') {
      setIsSurveyorSigned(false);
      setSurveyorSignatureDataUrl('');
    }
    if (role === 'chief') {
      setIsChiefSigned(false);
      setChiefSignatureDataUrl('');
    }
  };

  // ฟังก์ชันเพิ่มอุปกรณ์แบบ Dynamic
  const handleAddShield = () => {
    const newShield: ShieldItem = {
      id: 'shield_' + Date.now(),
      name: '',
      condition: 'สมบูรณ์ดี',
      crackCheck: 'ไม่มีรอยแตก',
      imageLink: '',
      imageBase64: ''
    };
    setShields([...shields, newShield]);
  };

  const handleRemoveShield = (id: string) => {
    setShields(shields.filter(s => s.id !== id));
  };

  const handleUpdateShield = (id: string, fields: Partial<ShieldItem>) => {
    setShields(shields.map(s => s.id === id ? { ...s, ...fields } : s));
  };

  // อัปโหลดและแปลงภาพถ่ายเป็น Base64
  const handleShieldImageUpload = (id: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        handleUpdateShield(id, { imageBase64: e.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  // ดำเนินการกดบันทึกผลการตรวจสอบ QC
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!surveyorName.trim()) {
      alert("กรุณากรอกชื่อพนักงานรังสีเทคนิคผู้ตรวจวัด");
      return;
    }
    if (!chiefName.trim()) {
      alert("กรุณากรอกชื่อหัวหน้าแผนกตรวจสอบ");
      return;
    }
    if (!isSurveyorSigned) {
      alert("กรุณาลงนามลายเซ็นอิเล็กทรอนิกส์ในช่องพนักงานการแพทย์ผู้ตรวจ");
      return;
    }
    if (!isChiefSigned) {
      alert("กรุณาลงนามลายเซ็นอิเล็กทรอนิกส์ในช่องหัวหน้าผู้ตรวจสอบด้วย");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("กำลังยืนยันลายเซ็นและจัดรูปแบบข้อมูลลงสารบบ...");

    // ดึงลายรูปจาก Canvas
    const sigSurveyorData = canvasSurveyorRef.current ? canvasSurveyorRef.current.toDataURL() : '';
    const sigChiefData = canvasChiefRef.current ? canvasChiefRef.current.toDataURL() : '';

    const newRecord: QCRecord = {
      id: 'record_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      surveyorName: surveyorName,
      chiefName: chiefName,
      items: { ...checklist },
      sidValue: sidValue,
      errorX: errorX,
      errorY: errorY,
      collimatorResult: isCollimatorPass,
      shields: [...shields],
      sigSurveyor: sigSurveyorData,
      sigChief: sigChiefData
    };

    // ส่งเข้า GAS (ถ้าอยู่ในสิ่งแวดล้อม GAS)
    // @ts-ignore
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      // @ts-ignore
      google.script.run
        .withSuccessHandler((response: any) => {
          setIsSubmitting(false);
          if (response && response.success) {
            setSubmitStatus("บันทึกเข้าระบบ Google Sheets สำเร็จ!");
            alert("บันทึกข้อมูลและแนบภาพถ่ายขึ้น Google Drive เรียบร้อยแล้ว!");
            // จัดเก็บลง local state ประวัติด้วย
            const updated = [newRecord, ...records];
            setRecords(updated);
            localStorage.setItem('rt_qc_records', JSON.stringify(updated));
            resetForm();
          } else {
            alert("เกิดข้อผิดพลาดในการส่งข้อมูลขึ้น Sheets: " + (response?.message || "ระบบไม่ตอบรับ"));
          }
        })
        .withFailureHandler((err: any) => {
          setIsSubmitting(false);
          alert("เกิดความผิดพลาดในการเชื่อมต่อ Google API: " + err.toString());
        })
        .submitQCReport({
          surveyorName: surveyorName,
          chiefName: chiefName,
          mechChecklist: {
            item1: checklist.item1,
            item2: checklist.item2,
            item3: checklist.item3,
            item4: checklist.item4,
            item5: checklist.item5,
            item6: checklist.item6,
            item7: checklist.item7
          },
          sidValue: sidValue,
          errorX: errorX,
          errorY: errorY,
          collimatorResult: isCollimatorPass,
          shields: shields.map(s => ({
            name: s.name,
            condition: s.condition,
            crackCheck: s.crackCheck,
            imageBase64: s.imageBase64,
            imageLink: s.imageLink
          })),
          signatureSurveyor: sigSurveyorData,
          signatureChief: sigChiefData
        });
    } else {
      // จำลองการบันทึกเมื่ออยู่ใน Sandbox Dev Server
      setTimeout(() => {
        setIsSubmitting(false);
        const updated = [newRecord, ...records];
        setRecords(updated);
        localStorage.setItem('rt_qc_records', JSON.stringify(updated));
        
        alert("🎉 [จำลองสำเร็จสำหรับเครื่องพรีวิว Local]\nระบบจำลองการส่งข้อมูลสตรีมไปยัง Google Sheets (ID: 18jG7rJ4l5BIoPES85mkII5JBNCu8KQaIBFzCQa9Egew) และเชื่อมโยงบันทึกไฟล์กับ Google Drive (ID โฟลเดอร์: 1gpz_bUEGkchKfq3hHueABybNqRM8HOss) ลงบราวเซอร์แคชเรียบร้อยแล้ว!\n\nคุณสามารถสลับไปยังแท็บ 'หน้ารายงานผลการ QC พร้อมภาพ' หรือ 'ประวัติผลการตรวจ' ด้านบนเพื่อพรีวิวตรวจสอบรายงานได้ทันที!");
        resetForm();
      }, 1500);
    }
  };

  const resetForm = () => {
    setSurveyorName('');
    setChiefName('');
    setChecklist({
      item1: 'ปกติ',
      item2: 'ปกติ',
      item3: 'ปกติ',
      item4: 'ปกติ',
      item5: 'ปกติ',
      item6: 'ปกติ',
      item7: 'ปกติ',
    });
    setSidValue(100);
    setErrorX(1.2);
    setErrorY(0.8);
    setShields([
      {
        id: 'shield_initial_1',
        name: 'เสื้อตะกั่วป้องกันรังสี (Lead Apron) #042',
        condition: 'สมบูรณ์ดี',
        crackCheck: 'ไม่มีรอยแตก',
        imageLink: '',
        imageBase64: ''
      },
      {
        id: 'shield_initial_2',
        name: 'ปลอกคอกันรังสี (Thyroid Shield) #01',
        condition: 'สมบูรณ์ดี',
        crackCheck: 'ไม่มีรอยแตก',
        imageLink: '',
        imageBase64: ''
      }
    ]);
    clearCanvas('surveyor');
    clearCanvas('chief');
    setSubmitStatus(null);
  };

  // ตรองประวัติย้อนหลังด้วยคีย์เวิร์ดค้นหา
  const filteredRecords = records.filter(rec => 
    rec.surveyorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.chiefName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.timestamp.includes(searchQuery)
  );

  const triggerRemovePastRecord = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      const filtered = records.filter(r => r.id !== deleteConfirmId);
      setRecords(filtered);
      localStorage.setItem('rt_qc_records', JSON.stringify(filtered));
      setDeleteConfirmId(null);
    }
  };

  // รหัสต้นฉบับ GAS
  const gasCodeSnippet = `/**
 * Google Apps Script - Code.gs
 * ระบบบันทึกข้อมูลและติดตามผลงาน QC ราย 3-6 เดือน ด้านกลไกและความเที่ยงตรง
 * แผนกรังสีเทคนิค โรงพยาบาลแม่ทา
 */

const SHEET_ID = "18jG7rJ4l5BIoPES85mkII5JBNCu8KQaIBFzCQa9Egew";
const DRIVE_FOLDER_ID = "1gpz_bUEGkchKfq3hHueABybNqRM8HOss";

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบบันทึก QC คลินิกรังสีเทคนิค - รพ.แม่ทา')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitQCReport(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0] || SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    
    const timestamp = new Date();
    const dateFormatted = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    // 1. อัปโหลดรูปภาพลายเซ็นผู้ตรวจ
    let signatureSurveyorUrl = "";
    if (data.signatureSurveyor && data.signatureSurveyor.startsWith("data:image")) {
      signatureSurveyorUrl = saveBase64ImageToDrive(data.signatureSurveyor, \`Sig_Surveyor_\${data.surveyorName.replace(/\\s+/g, '_')}_\${Date.now()}.png\`, folder);
    }
    
    // 2. อัปโหลดรูปภาพลายเซ็นผู้ตรวจสอบ (หัวหน้างาน)
    let signatureChiefUrl = "";
    if (data.signatureChief && data.signatureChief.startsWith("data:image")) {
      signatureChiefUrl = saveBase64ImageToDrive(data.signatureChief, \`Sig_Chief_\${data.chiefName.replace(/\\s+/g, '_')}_\${Date.now()}.png\`, folder);
    }
    
    // 3. แนบอัปโหลดภาพอุปกรณ์ทั้งหมดแบบ Dynamic
    const processedShields = [];
    if (data.shields && data.shields.length > 0) {
      for (let i = 0; i < data.shields.length; i++) {
        const shield = data.shields[i];
        let imageUrl = shield.imageLink || "";
        
        if (shield.imageBase64 && shield.imageBase64.startsWith("data:image")) {
          const fileName = \`Shield_\${shield.name.replace(/[^a-zA-Z0-9]/g, "_")}_\${Date.now()}.png\`;
          imageUrl = saveBase64ImageToDrive(shield.imageBase64, fileName, folder);
        }
        processedShields.push({
          name: shield.name,
          condition: shield.condition,
          crackCheck: shield.crackCheck,
          imageUrl: imageUrl
        });
      }
    }
    
    const shieldInfoText = processedShields.map(s => \`\${s.name} (\${s.condition}, รอยแตก: \${s.crackCheck})\`).join(" | ");
    const shieldUrlsText = processedShields.map(s => s.imageUrl).filter(url => url !== "").join(", ");
    
    // 4. เพิ่มข้อมูลใหม่ลงเซลล์
    const rowData = [
      dateFormatted,                           // A: วันที่-เวลา
      data.surveyorName,                        // B: ชื่อผู้ตรวจ
      data.chiefName,                           // C: ชื่อหัวหน้าผู้พิจารณา
      data.mechChecklist.item1,                 // D: ความมั่นคงของฐานเครื่อง
      data.mechChecklist.item2,                 // E: การทำงานของตัวเบรกเคลื่อนที่
      data.mechChecklist.item3,                 // F: ความเที่ยงตรงของตัวชี้วัดมุม
      data.mechChecklist.item4,                 // G: ความขนานของพื้นผิวเตียง
      data.mechChecklist.item5,                 // H: การทำงานของสลักล็อกถาด Bucky
      data.mechChecklist.item6,                 // I: ความตึงของสายเคเบิล
      data.mechChecklist.item7,                 // J: ปุ่มหยุดฉุกเฉิน
      data.sidValue,                            // K: ระยะ SID
      data.errorX,                              // L: คลาดเคลื่อน แกน X
      data.errorY,                              // M: คลาดเคลื่อน แกน Y
      data.collimatorResult ? "ผ่าน" : "ไม่ผ่าน", // N: ผลทดสอบ Collimator
      shieldInfoText,                           // O: รายการข้อมูลเครื่องป้องกัน
      shieldUrlsText,                           // P: ลิงก์เก็บรูปป้องกัน
      signatureSurveyorUrl,                     // Q: ลายเซ็นผู้ตรวจ
      signatureChiefUrl                         // R: ลายเซ็นหัวหน้าผู้พิจารณา
    ];
    
    sheet.appendRow(rowData);
    return { success: true, message: "บันทึกข้อมูลเรียบร้อยแล้ว!" };
  } catch (err) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + err.toString() };
  }
}

function saveBase64ImageToDrive(base64Data, fileName, folder) {
  const splitData = base64Data.split(",");
  const contentType = splitData[0].match(/:(.*?);/)[1];
  const rawData = splitData[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(rawData), contentType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col antialiased">
      
      {/* 0. Dynamic iFrame Bypass Top Banner */}
      {isIframe && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md border-b border-indigo-500/10 no-print">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <div className="text-left leading-tight">
              <p className="text-xs font-black text-orange-400 tracking-wider uppercase">เชื่อมต่อผ่าน iFrame ของ AI Studio ดึงรายงานหรือโหลดภาพได้จำกัด</p>
              <p className="text-[10px] text-slate-300">คลิกที่ปุ่มสีส้มเพื่อขยายหน้าโปรแกรมลงเบราว์เซอร์จริง ปลดล็อกปุ่ม Print Preview และฟังก์ชันการแสดงภาพ 100%</p>
            </div>
          </div>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 focus:ring-2 focus:ring-orange-300 text-slate-950 font-black text-xs px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95 cursor-pointer ring-1 ring-orange-200"
          >
            <ExternalLink className="w-3.5 h-3.5" /> เปิดแอปในแท็บใหม่ (Open App in New Tab)
          </button>
        </div>
      )}

      {/* 1. Header Section (Geometric Balance Styled) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0066CC] rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-100 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              ระบบบันทึกและติดตามผลการตรวจสอบ QC ราย 3-6 เดือน
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Building className="w-3.5 h-3.5" /> แผนกรังสีเทคนิค โรงพยาบาลแม่ทา
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button 
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 text-xs font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'form' 
                ? 'bg-[#0066CC] text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> บันทึกผล QC ใหม่
          </button>
          
          <button 
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'history' 
                ? 'bg-[#0066CC] text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" /> ประวัติผลการตรวจ ({records.length})
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 text-xs font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'report' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <FileText className="w-4 h-4" /> หน้ารายงานผลการ QC พร้อมภาพ ({selectedReportRecord ? "ประวัติ" : "ร่างปัจจุบัน"})
          </button>
        </div>
      </header>

      {/* 1.1 Quick Access Google Drive & Document Hyperlink Links (no-print) */}
      <div className="bg-slate-50 border-b border-slate-200/60 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded-full uppercase tracking-wider">Cloud Synchronized</span>
          <span className="text-xs font-semibold text-slate-500">ทางเลือกเข้าตรวจสอบเอกสารต้นทางที่จัดเก็บจริงได้สะดวกรวดเร็ว:</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://drive.google.com/drive/folders/1gpz_bUEGkchKfq3hHueABybNqRM8HOss"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" /> 📂 เปิดคลังภาพ Google Drive
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/18jG7rJ4l5BIoPES85mkII5JBNCu8KQaIBFzCQa9Egew/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> 📊 เปิดฐานข้อมูล Google Sheets
          </a>
        </div>
      </div>

      {/* 2. Main Container holding the Active View */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        
        {/* TAB 1: FORM VIEW */}
        {activeTab === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* ส่วนที่ 1: ข้อมูลทั่วไปและบุคลากร */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm print-card">
              <h2 className="text-sm font-extrabold text-[#004488] border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#0066CC] rounded-full"></span>
                ส่วนที่ 1: ข้อมูลหน่วยงานและบุคลากรตรวจสอบความเที่ยงตรง
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">สถาบัน / โรงพยาบาล</label>
                  <input 
                    type="text" 
                    value="แผนกรังสีเทคนิค โรงพยาบาลแม่ทา" 
                    disabled 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                    พนักงานสาธารณสุขการแพทย์และรังสี (ผู้ตรวจ)
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    placeholder="ป้อนชื่อผู้ดำเนินการตรวจวัด" 
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                    หัวหน้างานรังสีเทคนิค (ผู้ตรวจสอบ)
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={chiefName}
                    onChange={(e) => setChiefName(e.target.value)}
                    placeholder="ป้อนชื่อหัวหน้าผู้ลงนามตรวจสอบ" 
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all" 
                  />
                </div>
              </div>
            </div>

            {/* ส่วนล่างแบ่ง Column แบบ Geometric Balance */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* ซีกซ้าย: 7 รายการตรวจสอบกลไกเครื่อง F4 */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm print-card">
                <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                  <h2 className="text-sm font-extrabold text-[#004488] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-[#0066CC] rounded-full"></span>
                    ส่วนที่ 2: แบบตรวจเช็ค F4 (กลไก 7 รายการ)
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold">รอบ 3-6 เดือน</span>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(checklistLabels).map(([key, label]) => (
                    <div key={key} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold text-slate-700">{label}</span>
                      
                      <div className="flex bg-slate-200 p-0.5 rounded-md gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setChecklist({ ...checklist, [key]: 'ปกติ' })}
                          className={`px-3 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            checklist[key] === 'ปกติ'
                              ? 'bg-green-500 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          ปกติ
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklist({ ...checklist, [key]: 'ชำรุด' })}
                          className={`px-3 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            checklist[key] === 'ชำรุด'
                              ? 'bg-red-500 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          ชำรุด
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ซีกขวา: Collimator Accuracy & Dynamic Lead Shields */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 3.1: เครื่องคำนวณเบี่ยงเบนแนวรังสี Collimator */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm print-card">
                  <h2 className="text-sm font-extrabold text-[#004488] border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-[#0066CC] rounded-full"></span>
                    ส่วนที่ 3.1: ความคลาดเคลื่อนแสง Collimator & แรสเตอร์ล้อมแนว
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label htmlFor="sidValue" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ระยะตั้ง SID (ซม.)</label>
                      <input 
                        type="number" 
                        id="sidValue" 
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                        value={sidValue}
                        min={10}
                        onChange={(e) => setSidValue(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label htmlFor="errorX" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ความคลาดเบี่ยง แกน X (ซม)</label>
                      <input 
                        type="number" 
                        id="errorX"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                        value={errorX}
                        step="0.1"
                        min="0"
                        onChange={(e) => setErrorX(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label htmlFor="errorY" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ความคลาดเบี่ยง แกน Y (ซม)</label>
                      <input 
                        type="number" 
                        id="errorY"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                        value={errorY}
                        step="0.1"
                        min="0"
                        onChange={(e) => setErrorY(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </div>

                  <div className={`p-4 border rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-all ${
                    isCollimatorPass 
                      ? 'bg-green-50/70 border-green-200' 
                      : 'bg-red-50/70 border-red-200'
                  }`}>
                    <div className="space-y-1">
                      <p className={`text-xs font-bold ${isCollimatorPass ? 'text-green-800' : 'text-red-800'}`}>
                        {isCollimatorPass ? "ผ่านการตรวจสอบมาตรฐานมหาชน" : "ไม่ผ่านเกณฑ์การทดสอบ"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        เกณฑ์ความเบี่ยงเบนแต่ละแนวแกนรวมต้องไม่เพิ่มเกิน 2% ของระยะทดสอบ SID (ซึ่งค่าจำกัดมาตรฐานคือ {allowedLimit} ซม.)
                      </p>
                    </div>

                    <div className={`px-4 py-1 text-xs font-extrabold rounded-full shadow-sm select-none tracking-widest ${
                      isCollimatorPass 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white animate-pulse'
                    }`}>
                      {isCollimatorPass ? "ผ่าน" : "ไม่ผ่าน"}
                    </div>
                  </div>
                </div>

                {/* 3.2: ตะแกรงอุปกรณ์ป้องกันรังสี Dynamic (Multi-Item Row) */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm print-card flex flex-col">
                  <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                    <h2 className="text-sm font-extrabold text-[#004488] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-[#0066CC] rounded-full"></span>
                      ส่วนที่ 3.2: ตรวจจับเสื้อตะกั่ว/แว่น/อุปกรณ์รายชิ้นป้องกันรังสี
                    </h2>
                    
                    <button
                      type="button"
                      onClick={handleAddShield}
                      className="inline-flex items-center gap-1 bg-[#0066CC] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-opacity-90 cursor-pointer shadow-sm shadow-blue-100 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> + เพิ่มชิ้นงานอุปกรณ์
                    </button>
                  </div>

                  {shields.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      ไม่มีอุปกรณ์ที่จะระบุเพิ่มเติมคลิกปุ่มด้านบน "+ เพิ่มชิ้นงานอุปกรณ์" เพื่อบันทึกตรวจทีละรายการ
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                      {shields.map((shield, index) => (
                        <div key={shield.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative flex flex-col gap-3">
                          
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#0066CC]">อุปกรณ์ป้องกันรังสี รายที่ #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveShield(shield.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-slate-200 cursor-pointer"
                              title="ลบแถวชิ้นนี้ออก"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">รหัส & ชื่องานอุปกรณ์</label>
                              <input
                                type="text"
                                required
                                value={shield.name}
                                onChange={(e) => handleUpdateShield(shield.id, { name: e.target.value })}
                                placeholder="เช่น เสื้อตะกั่วคลุมรอบเบอร์ 5"
                                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">สภาพพื้นผิวเครื่องมือ</label>
                              <select 
                                value={shield.condition}
                                onChange={(e) => handleUpdateShield(shield.id, { condition: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                              >
                                <option value="สมบูรณ์ดี">สมบูรณ์ดี</option>
                                <option value="มีรอยยับเล็กน้อย">มีรอยยับเล็กน้อย</option>
                                <option value="ยับยุ่ยเล็กน้อย">ยับยุ่ยเล็กน้อย</option>
                                <option value="ชำรุดรอซ่อมบำรุง">ชำรุดรอซ่อมบำรุง</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ผลเช็ครอยหักแตก (X-Ray Crack Check)</label>
                              <select
                                value={shield.crackCheck}
                                onChange={(e) => handleUpdateShield(shield.id, { crackCheck: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                              >
                                <option value="ไม่มีรอยแตก">ไม่มีรอยแตก (ผ่าน)</option>
                                <option value="พบเนื้อตะกั่วบางจุด">พบเนื้อตะกั่วบางและหักเล็กน้อย</option>
                                <option value="พบรอยแตกหักรุนแรงชัดเจน">พบรอยแตกหักรุนแรงชัดเจน (ไม่ผ่าน)</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-1 pt-3 border-t border-slate-200/80 space-y-3">
                            <div>
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1.5 tracking-wide">
                                📸 เลือกวิธีแนบรูปถ่ายอุปกรณ์ป้องกันรังสี (แนบวิธีใดวิธีหนึ่ง หรือทั้งสองวิธีเพื่อบันทึก)
                              </span>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* วิธีแรก: อัปโหลดไฟล์จากคอมพิวเตอร์ (PC) */}
                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between space-y-2 shadow-inner-sm">
                                  <div>
                                    <label className="text-[9.5px] font-black text-indigo-700 flex items-center gap-1 uppercase">
                                      💻 วิธีที่ 1: อัปโหลดไฟล์รูปภาพตรงจาก PC / โทรศัพท์มือถือ
                                    </label>
                                    <p className="text-[9px] text-slate-400 mb-2 font-medium">ระบบจะบันทึกรูปและแปลงภาพเข้าคลังแบบออฟไลน์ทันที (แนะนำและรวดเร็ว)</p>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleShieldImageUpload(shield.id, file);
                                      }}
                                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                    />
                                  </div>
                                  {shield.imageBase64 && (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-2 rounded-lg mt-1.5">
                                      <span className="text-[9px] text-emerald-800 font-extrabold flex items-center gap-1">✔ อัปโหลดสำเร็จ (Base64)</span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateShield(shield.id, { imageBase64: '' })}
                                        className="text-[9px] text-rose-600 hover:text-rose-800 font-black underline cursor-pointer"
                                      >
                                        ลบรหัสไฟล์ PC
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* วิธีที่สอง: ลิงก์เชื่อมโยงทาง Google Drive */}
                                <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between space-y-2 shadow-inner-sm">
                                  <div className="space-y-1">
                                    <label className="text-[9.5px] font-black text-emerald-700 flex items-center gap-1 uppercase">
                                      🔗 วิธีที่ 2: วางลิงก์รูปถ่ายยืนยันจาก Google Drive ของท่าน
                                    </label>
                                    <p className="text-[9px] text-slate-400 mb-1 font-medium">กรณีอัปโหลดขึ้นโฟลเดอร์รวบรวมของแผนกแล้ว (ต้องเปิดสิทธิ์การเข้าถึงคนภายนอก)</p>
                                    <div className="flex gap-2">
                                      <input
                                        type="url"
                                        value={shield.imageLink || ''}
                                        onChange={(e) => handleUpdateShield(shield.id, { imageLink: e.target.value })}
                                        placeholder="วางลิงก์ เช่น https://drive.google.com/..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-emerald-600 placeholder:text-slate-400 font-medium"
                                      />
                                    </div>
                                  </div>
                                  {shield.imageLink && (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-2 rounded-lg mt-1.5">
                                      <a 
                                        href={shield.imageLink} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-[9px] text-emerald-800 hover:underline font-extrabold flex items-center gap-0.5"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" /> ทดสอบเปิดลิงก์ไดรฟ์ ↗
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateShield(shield.id, { imageLink: '' })}
                                        className="text-[9px] text-rose-600 hover:text-rose-800 font-black underline cursor-pointer"
                                      >
                                        เคลียร์ลิงก์
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <p className="text-[9.5px] text-slate-400 mt-2 font-medium leading-relaxed">
                                * แนะนำให้อัปโหลดโดยตรงจากเครื่อง PC เพื่อการพรีวิวพิมพ์รายงานออฟไลน์ หรือแนบแชร์ของ Google Drive โดยเปิดสิทธิ์ให้ "ทุกคนที่มีลิงก์อ่านได้" (Anyone with link can view) เพื่อให้สตรีมข้อมูลภาพครบถ้วนสูงสุด
                              </p>

                              {/* แสดงภาพพรีวิวผลลัพธ์ของอุปกรณ์ */}
                              {(shield.imageBase64 || shield.imageLink) && (
                                <div className="mt-3 p-2 bg-slate-100/80 border border-slate-200 rounded-lg max-w-[170px] shadow-sm flex flex-col items-center">
                                  <span className="text-[8px] font-black text-slate-500 mb-1 uppercase tracking-wider">
                                    🖼️ พรีวิวรูปแนบจริง {shield.imageBase64 ? "(จาก PC/มือถือ)" : "(จาก Google Drive)"}
                                  </span>
                                  <img
                                    src={shield.imageBase64 || getGoogleDrivePreviewUrl(shield.imageLink)}
                                    alt="พรีวิวอุปกรณ์ร่วม"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-24 object-cover rounded border border-slate-200"
                                    onError={(e) => {
                                      console.log("Form preview fallback error for shield:", shield.id);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ส่วนที่ 4: ลายเซ็นลงนามผู้ประเมินร่วม (Touch-Enabled Signature Canvas) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm print-card">
              <h2 className="text-sm font-extrabold text-[#004488] border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#0066CC] rounded-full"></span>
                ส่วนที่ 4: ลงนามพยานลายเซ็นดิจิทัลเพื่อรับรองความถูกต้องของระบบควบคุม
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Canvas ซ้าย: พนักงานรังสีเทคนิคผู้ตรวจ */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    พนักงานสาธารณสุขการแพทย์และรังสี (ผู้ตรวจ)
                    {isSurveyorSigned && <span className="text-green-600 text-[9.5px] font-extrabold">● เซ็นแล้ว</span>}
                  </span>
                  
                  <div className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex flex-col items-center justify-center min-h-[140px] canvas-container">
                    <canvas ref={canvasSurveyorRef} className="absolute inset-0 w-full h-full cursor-crosshair z-10 shrink-0"></canvas>
                    
                    {!isSurveyorSigned && (
                      <div className="pointer-events-none text-slate-300 text-xs flex flex-col items-center gap-2 select-none z-0">
                        <Pen className="w-6 h-6 text-slate-200" />
                        <span>ลากเมาส์เขียน หรือลวดนิ้วเบาๆ เพื่อลงลายเซ็นจำลอง</span>
                      </div>
                    )}
                    
                    <button 
                      type="button" 
                      onClick={() => clearCanvas('surveyor')}
                      className="no-print absolute bottom-2 right-2 px-2 py-1 text-[10px] font-bold text-slate-500 bg-white/90 border border-slate-200 rounded hover:bg-white z-20"
                    >
                      ล้างขีดวาด
                    </button>
                  </div>
                </div>

                {/* Canvas ขวา: หัวหน้างานตรวจสอบ */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    หัวหน้างานรังสีเทคนิค โรงพยาบาลแม่ทา (ผู้ตรวจสอบร่วม)
                    {isChiefSigned && <span className="text-green-600 text-[9.5px] font-extrabold">● เซ็นแล้ว</span>}
                  </span>

                  <div className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex flex-col items-center justify-center min-h-[140px] canvas-container">
                    <canvas ref={canvasChiefRef} className="absolute inset-0 w-full h-full cursor-crosshair z-10 shrink-0"></canvas>
                    
                    {!isChiefSigned && (
                      <div className="pointer-events-none text-slate-300 text-xs flex flex-col items-center gap-2 select-none z-0">
                        <Pen className="w-6 h-6 text-slate-200" />
                        <span>ลากเมาส์เขียน หรือลวดนิ้วเบาๆ เพื่อลงลายเซ็นจำลอง</span>
                      </div>
                    )}
                    
                    <button 
                      type="button" 
                      onClick={() => clearCanvas('chief')}
                      className="no-print absolute bottom-2 right-2 px-2 py-1 text-[10px] font-bold text-slate-500 bg-white/90 border border-slate-200 rounded hover:bg-white z-20"
                    >
                      ล้างขีดวาด
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* แถบแจ้งเตือนสถานะการบันทึก */}
            {isSubmitting && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-800 animate-pulse flex items-center justify-between no-print">
                <span>{submitStatus}</span>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent inline-block"></span>
              </div>
            )}

            {/* ปุ่มส่งฟอร์มด้านล่างสุด */}
            <div className="flex flex-col sm:flex-row justify-end gap-3.5 no-print">
              <button
                type="button"
                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" /> พิมพ์รายงาน/เซฟเป็น PDF
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-[#0066CC] hover:bg-[#0055BB] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-100"
              >
                <Save className="w-4 h-4" /> บันทึกผลตรวจวัดลงคลังข้อมูล
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: PAST RECORDS / HISTORY DATABASE */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-[#004488] uppercase tracking-wider">ประวัติผลการส่งตรวจสอบ QC แบบคลาวด์ท้องถิ่น (Local Cache Database)</h2>
                <p className="text-xs text-slate-500">เก็บสถิติตรวจสอบกลไกและความคลาดขยายเพื่อให้พร้อมทำรายงานรายสัปดาห์</p>
              </div>
              
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="ค้นหาตามชื่อผู้ตรวจ / วันที่..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0066CC]"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                {records.length === 0 ? (
                  <>
                    <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <span>ยังไม่มีประวัติการส่งฟอร์มในบราวเซอร์นี้ ลองกรอกฟอร์มแล้วกด "บันทึกข้อมูล" ในแท็บแรก</span>
                  </>
                ) : (
                  <span>ไม่พบรายการประวัติที่ตรงกับช่องคีย์ค้นหา "{searchQuery}"</span>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="p-3">วันที่เริ่มตรวจ</th>
                      <th className="p-3">ผู้บันทึก (พนักงานการแพทย์)</th>
                      <th className="p-3">ผู้ลงทะเบียนตรวจเช็ค</th>
                      <th className="p-3">เบี่ยงเบน Collimator</th>
                      <th className="p-3">สภาพ F4 (7 ชิ้น)</th>
                      <th className="p-3">เครื่องป้องกันรังสี</th>
                      <th className="p-3">ลายมือร่วม</th>
                      <th className="p-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRecords.map((rec) => {
                      const abnormalItems = Object.entries(rec.items || {}).filter(([_, status]) => status === 'ชำรุด');
                      
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 whitespace-nowrap text-slate-500 font-semibold">{rec.timestamp}</td>
                          <td className="p-3 whitespace-nowrap text-slate-800 font-bold">{rec.surveyorName}</td>
                          <td className="p-3 whitespace-nowrap text-slate-600">{rec.chiefName}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              rec.collimatorResult ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {rec.collimatorResult ? (
                                <>✔ ผ่าน (X={rec.errorX}, Y={rec.errorY})</>
                              ) : (
                                <>❌ เล็ดลอดเกิน (X={rec.errorX}, Y={rec.errorY})</>
                              )}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {abnormalItems.length === 0 ? (
                              <span className="text-green-600 font-bold">สมบูรณ์แข็งแรงทั้งหมด</span>
                            ) : (
                              <span className="text-red-500 font-bold">มีอาการชำรุด {abnormalItems.length} ตัวแปร</span>
                            )}
                          </td>
                          <td className="p-3 select-none">
                            <div className="max-w-[200px] truncate text-[10px] text-slate-500">
                              {(rec.shields || []).map(s => s?.name || '').filter(Boolean).join(', ') || 'ไม่มีเพิ่มอุปกรณ์เฉพาะ'}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex gap-2">
                              {rec.sigSurveyor && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold">พนักงานเซ็น</span>}
                              {rec.sigChief && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold">หัวหน้าเซ็น</span>}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  // โหลดใส่ฟอร์ม
                                  setSurveyorName(rec.surveyorName);
                                  setChiefName(rec.chiefName);
                                  // @ts-ignore
                                  setChecklist(rec.items || {
                                    item1: 'ปกติ',
                                    item2: 'ปกติ',
                                    item3: 'ปกติ',
                                    item4: 'ปกติ',
                                    item5: 'ปกติ',
                                    item6: 'ปกติ',
                                    item7: 'ปกติ',
                                  });
                                  setSidValue(rec.sidValue || 100);
                                  setErrorX(rec.errorX || 0);
                                  setErrorY(rec.errorY || 0);
                                  setShields(rec.shields || []);
                                  setActiveTab('form');
                                  alert("โหลดประวัติผลเครื่องตรวจมาวางที่แบบฟอร์มแล้ว!");
                                }}
                                className="px-2 py-1 bg-blue-50 text-[#0066CC] hover:bg-blue-100 text-[10px] font-bold rounded cursor-pointer"
                              >
                                เรียกใช้
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedReportRecord(rec);
                                  setActiveTab('report');
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded cursor-pointer transition-colors"
                              >
                                รายงานพร้อมภาพ
                              </button>
                              <button
                                onClick={() => triggerRemovePastRecord(rec.id)}
                                className="p-1 text-[#0066CC] hover:text-red-500 rounded hover:bg-slate-100 cursor-pointer"
                                title="ลบข้อมูลชั่วคราวชิ้นนี่"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLETE QC CLINICAL REPORT VIEW (หน้ารายงานผลการ QC พร้อมภาพและลายเซ็นต์) */}
        {activeTab === 'report' && (() => {
          // ดึงข้อมูลพรีวิวรูปวาดถ้าเลือกจากประวัติ หรือ ดึงจากค่าว่างร่างปัจจุบัน
          const isHistoryPrerender = selectedReportRecord !== null;
          
          const reportData = selectedReportRecord || {
            id: 'current-draft-report',
            timestamp: new Date().toLocaleDateString('th-TH', { 
              year: 'numeric', month: 'long', day: 'numeric', 
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            }) + " (ร่างพรีวิวปัจจุบัน)",
            surveyorName: surveyorName || "(ยังไม่ได้กรอกชื่อผู้ตรวจวัด)",
            chiefName: chiefName || "(ยังไม่ได้กรอกชื่อหัวหน้า)",
            items: { ...checklist },
            sidValue: sidValue,
            errorX: errorX,
            errorY: errorY,
            collimatorResult: isCollimatorPass,
            shields: [...shields],
            sigSurveyor: surveyorSignatureDataUrl || '',
            sigChief: chiefSignatureDataUrl || ''
          };

          const calculatedTotalError = Math.abs(reportData.errorX) + Math.abs(reportData.errorY);
          const limitValue = reportData.sidValue * 0.02;
          const isCalculatedPass = calculatedTotalError <= limitValue;

          // รายการฉลากประกอบไทยสำหรับ F4 7 รายการ
          const itemNamesTh: { [key: string]: string } = {
            item1: '1. โครงสร้างภายนอกเตียงและเสาจับส่วนเคลื่อนไหว',
            item2: '2. ระบบและตัวล็อกสำหรับล็อกเสาและเตียง (เบรกขยับเคลื่อนที่)',
            item3: '3. ความแม่นยำในการชี้แนวและตัวระบุทิศมุมการหมุนหลอดเอกซเรย์',
            item4: '4. ระดับและความขนานเชิงกายภาพของระนาบหน้าผิวโต๊ะวางผู้ป่วย',
            item5: '5. ชุดล็อกและสไลด์ขึ้นลงสลักของตัวถาด Bucky คาสเซ็ท',
            item6: '6. ตัวปะคองความตึงแน่นและความตรงของสายสลิงเคเบิลถ่วงสมดุล',
            item7: '7. ฟังก์ชันความปลอดภัยวงจรปุ่มรีเซ็ตฉุกเฉิน (Emergency Stop)',
          };

          return (
            <div className="space-y-6">
              
              {/* แผงควบคุมลอยสำหรับรายงานใบนี้ (no-print) */}
              <div className="bg-slate-850 bg-slate-900 border border-slate-700/60 p-5 rounded-xl text-white shadow-lg space-y-4 no-print transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isHistoryPrerender 
                        ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' 
                        : 'bg-indigo-500 text-white ring-4 ring-indigo-500/20 animate-pulse'
                    }`}>
                      <FileText className="w-3.5 h-3.5" />
                      {isHistoryPrerender ? 'แสดงข้อมูลรายงานจากสารบบประวัติเก็บถาวร' : 'แสดงภาพร่างรายงานจริงระหว่างตรวจวัด (ร่างพรีวิว)'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {isHistoryPrerender 
                        ? `กู้บันทึกข้อมูลของแพทย์ / เจ้าหน้าที่รังสีเทคนิค คุณ [${reportData.surveyorName}] ตรวจสอบสำเร็จพร้อมพยานตรวจรับ` 
                        : 'นี่คือใบจำลองพรีวิวใบนำเสนอตัวอย่างฉบับสมบูรณ์ ประกอบด้วยรูปจาก URL แนบจริง และลายเซ็นลายมือขีดเขียนดิจิทัล'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {isHistoryPrerender && (
                      <button
                        type="button"
                        onClick={() => setSelectedReportRecord(null)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" /> ดูร่างปัจจุบัน
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-5 py-2 rounded-lg shadow-md cursor-pointer transition-all flex items-center gap-1.5 transform active:scale-95 ring-2 ring-amber-300"
                    >
                      <Printer className="w-4 h-4" /> กดพิมพ์เอกสารนี้ / บันทึก PDF (Print Report)
                    </button>
                  </div>
                </div>
              </div>

              {/* กระดาษรายงานจำลอง (Printable Paper Sheet Wrapper) */}
              <div className="bg-white border md:border-slate-350 border-slate-300 rounded-lg p-8 pl-10 pr-10 shadow-lg print:border-none print:shadow-none print:p-0">
                
                {/* ส่วนหัวกระดาษรายงานแบบเป็นทางการ (Clinical Formal Report Header) */}
                <div className="border-b-4 border-[#004488] pb-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
                  <div className="flex items-center gap-4 flex-col md:flex-row">
                    <div className="w-14 h-14 bg-[#004488] text-white rounded-xl flex items-center justify-center font-black shadow-md shrink-0">
                      <ShieldCheck className="w-9 h-9" />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-black text-[#004488] tracking-tight leading-tight">
                        ใบรายงานสรุปผลการประเมินคุณภาพเครื่องเอกซเรย์ทั่วไปประจำรอบ
                      </h2>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        ตรวจกลไก ความเที่ยงตรง และระบบความหนาแน่นเครื่องและแผงป้องกันรังสีราย 3-6 เดือน
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">
                        แผนกรังสีเทคนิค กลุ่มงานรังสีวิทยา โรงพยาบาลแม่ทา อำเภอแม่ทา จังหวัดลำพูน
                      </p>
                    </div>
                  </div>
                  <div className="text-center md:text-right shrink-0 border-t border-slate-100 md:border-none pt-2 md:pt-0">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-widest">Document Registry No.</span>
                    <span className="text-xs font-mono font-extrabold text-[#004488]">MEATHA-RAD-QC-REP-{Date.now().toString().slice(-6)}</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-1">พิมพ์วันที่ {reportData.timestamp}</span>
                  </div>
                </div>

                {/* ส่วนสาระข้อมูลผู้วัดและวันเริ่มตรวจสอบ */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-6 print-card">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none mb-1">เจ้าหน้าที่ผู้ปฏิบัติการประเมินผลเครื่องวัด (พนักงานรังสีเทคนิค)</span>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-1.5"><Pen className="w-3.5 h-3.5 text-blue-600" /> {reportData.surveyorName}</p>
                    <span className="text-[10.5px] text-slate-500 mt-1 block">ประจำหน่วยงานรังสีวินิจฉัย โรงพยาบาลแม่ทา</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none mb-1">พยานผู้รับมอบและตรวจสอบเห็นพ้อง (หัวหน้าฝ่ายงานกลุ่มบริการ)</span>
                    <p className="text-sm font-black text-slate-800 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {reportData.chiefName}</p>
                    <span className="text-[10.5px] text-slate-500 mt-1 block">กลุ่มงานรังสีวิทยาความปลอดภัยสูงสุด</span>
                  </div>
                </div>

                {/* หมวดส่วนที่ 1: รายการเช็คหัวข้อความมั่นคงปลอดภัยทางโครงสร้างภายนอก F4 (7 ชิ้น) */}
                <div className="space-y-3 mb-6 print-card">
                  <h3 className="text-xs font-black text-[#004488] border-b border-slate-200 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#0066CC] rounded-sm"></span>
                    ผลลัพธ์ส่วนที่ 1: ตรวจประเมินทางระบบกลไกและความเสถียรปลอดภัย (F4)
                  </h3>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[#004488] font-black text-[9.5px] tracking-wide uppercase">
                          <th className="p-2.5 pl-4">รายการกลไกที่เข้าประเมิน (Mechanical Safety)</th>
                          <th className="p-2.5 w-40 text-center">ระดับผลการวิเคราะห์</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {Object.entries(itemNamesTh).map(([key, label]) => {
                          const status = reportData.items[key] || 'ปกติ';
                          const isPass = status === 'ปกติ';
                          return (
                            <tr key={key} className="hover:bg-slate-50/50">
                              <td className="p-2.5 pl-4 font-semibold text-slate-800">{label}</td>
                              <td className="p-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black ${
                                  isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {isPass ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                                  {isPass ? 'ผ่าน (ปกติ)' : 'ตรวจพบจุดชำรุด'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* หมวดส่วนที่ 2: ความคลาดเคลื่อนแนวแสงนำลำรังสีรักษารวดเร็ว (Collimator Alignment Accuracy) */}
                <div className="space-y-3 mb-6 print-card">
                  <h3 className="text-xs font-black text-[#004488] border-b border-slate-200 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#0066CC] rounded-sm"></span>
                    ผลลัพธ์ส่วนที่ 2: วิเคราะห์การจัดแนวตรงและความสัมพันธ์แนวแสงนำลำรัศมีเอกซเรย์
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4 bg-slate-50/20">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-center shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">ระยะห่างทดสอบจริง (SID)</span>
                      <span className="text-lg font-mono font-black text-[#0066CC]">{reportData.sidValue}</span> <span className="text-xs text-slate-500 font-bold">cm</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-center shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">ผลสรุปผลรวมเบี่ยงเบนแนวลำรังสี</span>
                      <span className="text-xs text-slate-500 block">
                        แกน X: <strong className="font-mono text-slate-800">|ΔX| = {reportData.errorX} cm</strong> | แกน Y: <strong className="font-mono text-slate-800">|ΔY| = {reportData.errorY} cm</strong>
                      </span>
                      <span className="text-sm font-mono font-black text-rose-600 block mt-1">
                        ผลคลาดเคลื่อนสะสม = {calculatedTotalError.toFixed(2)} cm
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">ผลการประเมินระบบ</span>
                      <span className="text-[9px] text-indigo-500 block leading-none font-bold mb-1">(เกณฑ์มาตรวัดคลาดชิดสูงสุดต้องไม่ลื่นเกิน 2% SID คือ {limitValue.toFixed(2)} cm)</span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ring-4 ${
                        isCalculatedPass 
                          ? 'bg-green-100 text-green-800 ring-green-100/30' 
                          : 'bg-red-100 text-red-800 ring-red-100/30 font-black animate-pulse'
                      }`}>
                        {isCalculatedPass ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {isCalculatedPass ? 'ผ่าน (ผ่านเกณฑ์มาตรฐาน)' : 'ไม่ผ่านเกณฑ์ (ควรสอบเทียบใหม่)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* หมวดส่วนที่ 3: สรุปความหนาแน่นและความสมบูรณ์ของอุปกรณ์ป้องกันรังสีพร้อมภาพ (Lead Protective Shields with Google Drive Image) */}
                <div className="space-y-4 mb-8 print-card">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-black text-[#004488] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#0066CC] rounded-sm"></span>
                      ผลลัพธ์ส่วนที่ 3: ตรวจสอบรูปทรง ความสมบูรณ์ และภาพยืนยันเครื่องชิ้นงานป้องกันรังสี
                    </h3>
                  </div>

                  {reportData.shields.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-medium">
                      ไม่มีการระบุอัพเดตตรวจสอบอุปกรณป้องกันรังสีเพิ่มเติมในคลังรายงานใบนี้
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportData.shields.map((shield, idx) => {
                        const hasBase64 = shield.imageBase64 && shield.imageBase64.trim() !== '';
                        const hasDriveLink = shield.imageLink && shield.imageLink.trim() !== '';
                        const hasImage = hasBase64 || hasDriveLink;
                        const finalImageUrl = hasBase64 ? shield.imageBase64 : (hasDriveLink ? getGoogleDrivePreviewUrl(shield.imageLink) : '');
                        const isCrackFail = shield.crackCheck.includes('ไม่ผ่าน') || shield.crackCheck.includes('ร้าวรุนแรง') || shield.crackCheck.includes('รอยแตกหักรุนแรงชัดเจน');

                        return (
                          <div key={shield.id || idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 relative flex flex-col justify-between shadow-sm">
                            <div className="space-y-2">
                              {/* สลากชื่อชิ้นงาน */}
                              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                                <span className="font-extrabold text-xs text-slate-800">#{idx + 1}. {shield.name || "(ไม่ระบุชื่อ)"}</span>
                                <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded ${
                                  isCrackFail ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isCrackFail ? 'ตรวจพบจุดร้าว (ไม่ผ่าน)' : 'ผ่านข้อตรวจสอบ'}
                                </span>
                              </div>

                              <ul className="text-[11px] text-slate-600 leading-relaxed font-semibold space-y-1">
                                <li>สภาพพื้นผิวภายนอก: <span className="text-slate-800 font-extrabold">{shield.condition}</span></li>
                                <li>การประเมินรอยร้าวรังสี: <span className="text-slate-800 font-extrabold">{shield.crackCheck}</span></li>
                                {hasBase64 && (
                                  <li>
                                    การเก็บบันทึกโฮสต์: <span className="text-indigo-600 font-extrabold text-[10px]">บันทึกรูปภาพโดยตรงจาก PC (Base64)</span>
                                  </li>
                                )}
                                {hasDriveLink && (
                                  <li className="truncate">
                                    ลิงก์ไดรฟ์เก็บบันทึก: <a href={shield.imageLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-extrabold underline hover:text-blue-800 text-[10px] truncate">{shield.imageLink}</a>
                                  </li>
                                )}
                              </ul>
                            </div>

                            {/* กรอบแสดงภาพถ่ายจาก Google Drive หรือ PC */}
                            <div className="mt-3 flex flex-col items-center">
                              {hasImage ? (
                                <div className="border border-slate-200 rounded-lg p-1.5 bg-white shadow-inner flex flex-col items-center justify-center w-full max-w-[240px]">
                                  <img
                                    src={finalImageUrl}
                                    alt={`รูปตรวจอุปกรณ์ ${shield.name}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-32 object-cover rounded border border-slate-100"
                                    onError={(e) => {
                                      // ตรวจพบข้อจำกัด iframe loading
                                      const label = (e.target as HTMLElement).nextSibling as HTMLElement;
                                      if (label) label.style.display = 'block';
                                    }}
                                  />
                                  {!hasBase64 && (
                                    <p className="text-[9px] text-amber-600 font-black mt-1 text-center hidden">
                                      ⚠️ เบราว์เซอร์ถูกจำกัดพรีวิวโดย iFrame! กรุณากด "เปิดแอปในแท็บใหม่" สีส้ม เพื่อดึงภาพจากไดรฟ์มาสแกนครบถ้วน
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg bg-white w-full max-w-[240px] text-center text-slate-400 text-[10px] font-semibold">
                                  ❌ ไม่มีรูปภายนอกเก็บบันทึก
                                  <span className="block text-[8px] text-slate-400 font-medium">(กรุณา อัปโหลดไฟล์จากคอมพิวเตอร์ หรือ วางลิงก์แชร์ของ Google Drive ตัวอุปกรณ์ในแบบฟอร์มบันทึก)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* หมวดส่วนที่ 4: ลายเซ็นลงนามผู้ร่วมประเมินจริง (Touch-Enabled Digital Signature Signoff Embed) */}
                <div className="mt-10 pt-6 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-8 text-center text-xs">
                    
                    {/* ข้อมูลอนุมัติบล็อกลายเซ็นผู้รายงานตรวจวัด */}
                    <div className="flex flex-col items-center justify-between h-32">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none block mb-1">
                        ลงชื่อผู้ตรวจรายงานคุณภาพ (พนักงานรังสีเทคนิค)
                      </span>
                      
                      {reportData.sigSurveyor ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={reportData.sigSurveyor} 
                            alt="ลายเซ็นผู้สำรวจตรวจสอบ" 
                            className="h-16 max-w-[140px] object-contain border-b border-dashed border-slate-200 pb-1.5" 
                          />
                        </div>
                      ) : (
                        <div className="border-b border-dark/20 w-44 h-12 flex items-end justify-center text-[10px] text-slate-400 pb-1 italic">
                          (ยังไม่ได้จัดชื่อลงนามลายเซ็นอิเล็กทรอนิกส์)
                        </div>
                      )}
                      
                      <div className="leading-tight mt-1">
                        <span className="font-extrabold text-[#004488] block text-[12.5px]">คุณ {reportData.surveyorName}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">พนักตรวจวินิจฉัยความปลอดภัย รพ.แม่ทา</span>
                      </div>
                    </div>

                    {/* ข้อมูลอนุมัติบล็อกลายเซ็นของหัวหน้าเห็นพ้อง */}
                    <div className="flex flex-col items-center justify-between h-32">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none block mb-1">
                        ลงชื่อลายลักษณ์พยาน / หัวหน้ารับรองมาตรฐานความเหมาะสม
                      </span>
                      
                      {reportData.sigChief ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={reportData.sigChief} 
                            alt="ลายเซ็นหัวหน้ารับรอง" 
                            className="h-16 max-w-[140px] object-contain border-b border-dashed border-slate-200 pb-1.5" 
                          />
                        </div>
                      ) : (
                        <div className="border-b border-dark/20 w-44 h-12 flex items-end justify-center text-[10px] text-slate-400 pb-1 italic">
                          (ยังไม่ได้จัดชื่อลงนามลายเซ็นอิเล็กทรอนิกส์)
                        </div>
                      )}
                      
                      <div className="leading-tight mt-1">
                        <span className="font-extrabold text-[#004488] block text-[12.5px]">คุณ {reportData.chiefName}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">หัวหน้าพิทักษ์กลุ่มงานรังสีวิทยารับรอบ</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ข้อบังคับพยานกฎหมายอย่างเคร่งครัดที่ระบุไว้ที่โรงพยาบาลรังสี */}
                <div className="mt-14 pt-3 border-t-2 border-slate-100 text-[9px] text-slate-300 text-center font-semibold uppercase tracking-widest leading-none flex items-center justify-center gap-2">
                  <span>QC-RT-HOSPITAL-MEATHA-MEMBER-APPROVED</span>
                  <span>●</span>
                  <span>ความเคร่งครัดระดับมาตรฐานกรมวิทยาศาสตร์การแพทย์และกลไกความเข้มความปลอดภัยสูงสุด</span>
                </div>

              </div>

              {/* ป้ายเตือนแนะนำสำหรับ iFrame (no-print) */}
              <div className="no-print bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed max-w-4xl mx-auto space-y-1">
                <p className="font-extrabold text-amber-800 flex items-center gap-1">⚠️ สำหรับผู้ใช้ที่ทดสอบบนระบบพรีวิวของ AI Studio:</p>
                <p>เนื่องจากมาตรการความปลอดภัยและนโยบายความเป็นส่วนตัวของเบราว์เซอร์ หากคุณนำเข้าหรือแชร์ลิงก์รูปภาพ Google Drive ตรงชิ้นงานแต่อิมเมจไม่ยอมแสดงผล (แสดงสัญลักษณ์กรอบตกขอบ) แนะนำให้ปรับสิทธิ์แชร์ไฟล์ในกูเกิลไดรฟ์เป็น <strong className="text-red-700">"ทุกคนที่มีลิงก์สามารถอ่านได้" (Anyone with the link can view)</strong> หรือแก้ไขสิทธิ์การตั้งค่าสิทธิของโครมบราวเซอร์เพื่ออนุญาตให้แสดงภาพบุคคลที่สาม</p>
              </div>

              {/* แผงวิธีกดสร้างระบบเชื่อมต่อผ่าน GAS (no-print) */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 no-print shadow-sm max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      💡
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">คู่ผู้ควบคุม: วิธีติดตั้ง Google Apps Script (GAS) เพื่อเชื่อมฐานข้อมูลและไดรฟ์จริง</h4>
                      <p className="text-[10px] text-slate-500 font-extrabold">ประสานรหัส Google Sheets โฮสต์และโฟลเดอร์สำหรับผู้ใช้แผนกรังสีเทคนิค</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGasGuide(!showGasGuide)}
                    className="text-xs font-black text-indigo-700 hover:text-indigo-900 border border-indigo-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg cursor-pointer transition-all shrink-0 shadow-sm"
                  >
                    {showGasGuide ? "▲ ซ่อนคำแนะนำ" : "▼ คลิกกางดูรหัสและวิธีติดตั้งจริง"}
                  </button>
                </div>

                {showGasGuide && (
                  <div className="border-t border-slate-200/80 pt-4 space-y-4 transition-all col-span-12">
                    <div className="bg-slate-100 rounded-lg p-3 text-slate-700 text-xs font-medium space-y-1 border border-slate-200">
                      <p className="font-extrabold text-indigo-800 flex items-center gap-1">📌 ตัวชี้วัดสถิติการเชื่อมโยงระบบของท่าน:</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-1.5 font-bold text-slate-600 text-[11px]">
                        <li>Google Sheet ID: <span className="font-mono text-indigo-700">18jG7rJ4l5BIoPES85mkII5JBNCu8KQaIBFzCQa9Egew</span></li>
                        <li>Google Drive Folder ID: <span className="font-mono text-indigo-700">1gpz_bUEGkchKfq3hHueABybNqRM8HOss</span></li>
                      </ul>
                      <p className="text-[10.5px] text-amber-700 font-extrabold mt-1">⚠️ รหัสและสิทธิ์โฟลเดอร์ถูกประกอบเข้าชุดรหัสจัดส่งให้อย่างสมบูรณ์แบบ แผนกรังสีเทคนิคไม่ต้องกรอกข้อมูลอะไรเพิ่มเติมเลยนอกจากการติดตั้งตามคำอธิบายด้านล่างครับ!</p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700 font-semibold pl-1">
                      <p className="font-black text-slate-800 text-xs">ขั้นตอนติดตั้งใน 2 นาที:</p>
                      <ol className="list-decimal list-inside pl-1 space-y-1.5 leading-relaxed text-[11px] text-slate-600">
                        <li>เปิด Google Sheets ของคุณ: 
                          <a href="https://docs.google.com/spreadsheets/d/18jG7rJ4l5BIoPES85mkII5JBNCu8KQaIBFzCQa9Egew/edit" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-extrabold ml-1 inline-flex items-center gap-0.5">คลิกเพื่อเปิดบัญชีชีต ↗</a>
                        </li>
                        <li>กดที่แถบเมนูด้านบน เลือกลำดับ <strong className="text-slate-900 font-bold">"ส่วนขยาย" (Extensions) &gt; "Apps Script"</strong></li>
                        <li>คัดลอกส่วนชุดรหัส <strong className="text-slate-950 font-black">My Apps Script Code.gs</strong> ทั้งหมดที่อยู่ในกล่องข้อความด้านล่างนี้</li>
                        <li>วางทับชุดรหัสเดิมในเครื่องพนักงานของคุณทั้งหมด</li>
                        <li>กดสัญรูป <strong className="text-indigo-800">"บันทึกโครงการ"</strong> สีน้ำเงินบนแถบเครื่องมือ</li>
                        <li>กดเลือกเมนูสีน้ำเงินขวาบน <strong className="text-indigo-800">"ทำให้ใช้งานได้" (Deploy) &gt; "การทำให้ใช้งานได้ใหม่" (New deployment)</strong></li>
                        <li>กดรูปฟันเฟืองเลือกประเภทการทำงานเป็น <strong className="text-emerald-700">"เว็บแอป" (Web app)</strong></li>
                        <li>หัวข้อ <em>"ผู้มีสิทธิ์เข้าถึง (Who has access)"</em> เลือกเปลี่ยนเป็น <strong className="text-red-600 font-black">"ทุกคน" (Anyone)</strong> จากนั้นกดปุ่ม "ทำให้ใช้งานได้"</li>
                        <li>ให้สิทธิ์การดาวน์โหลดบัญชีตามเงื่อนไขของ Google แล้วคัดลอก "URL เว็บแอป" นำไปเผยแพร่ใช้งานได้ตลอดกาล!</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-[#004488] uppercase tracking-wider block">ชุดรหัส Code.gs พร้อมอัพโหลด:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(gasCodeSnippet);
                            alert("คัดลอกชุดโค้ด Google Apps Script สำเร็จเรียบร้อย!");
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black px-3 py-1 rounded cursor-pointer transition-colors"
                        >
                          📋 คัดลอกรหัสผ่านบอร์ด
                        </button>
                      </div>
                      <pre className="p-3 bg-slate-900 text-[#00FF55] font-mono text-[10.5px] rounded-lg overflow-x-auto select-all max-h-56 leading-normal border border-slate-950">
                        {gasCodeSnippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

      </main>

      {/* Custom Delete Confirmation Modal */}
      {(() => {
        if (!deleteConfirmId) return null;
        const recordToDelete = records.find(r => r.id === deleteConfirmId);
        if (!recordToDelete) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in duration-200 text-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900">ยืนยันการลบรายการประวัติ?</h3>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
                    คุณต้องการลบรายการตรวจวัดคุณภาพเครื่อง QC ชิ้นนี้ออกจากหน่วยความจำจำลองของประวัติในเว็บเบราว์เซอร์เครื่องนี้ใช่หรือไม่?
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-[11px] space-y-1 border border-slate-200/60 font-semibold text-slate-700">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">รายละเอียดหัวข้อประวัติ:</p>
                <p><span className="text-slate-400 font-medium">วันที่ตรวจ:</span> {recordToDelete.timestamp}</p>
                <p><span className="text-slate-400 font-medium">ผู้รายงาน:</span> คุณ {recordToDelete.surveyorName}</p>
                <p><span className="text-slate-400 font-medium">พยาน/หัวหน้า:</span> คุณ {recordToDelete.chiefName}</p>
                <p>
                  <span className="text-slate-400 font-medium">ผลเครื่องมือ:</span> {recordToDelete.collimatorResult ? '✅ ผ่านเกณฑ์มาตรฐาน' : '❌ ตกเกณฑ์ชำรุด'}
                </p>
              </div>

              <p className="text-[10px] text-rose-600 font-black leading-snug">
                ⚠️ ข้อสังเกต: การกระทำนี้จะเป็นการลบออกจากระบบของคอมพิวเตอร์ปัจจุบันทันที และจะไม่สามารถเรียกคืนได้หากไม่ได้บันทึกไว้ในสเปรดชีตจริง!
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-3.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 text-[11px] font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ยืนยันสิทธิ์ลบประวัติ
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Footer Bar Section */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-[11px] text-slate-400 font-semibold gap-2 no-print">
        <div className="flex gap-4">
          <span>ความเที่ยงตรง: แผนกรังสีเทคนิค โรงพยาบาลแม่ทา</span>
          <span>● พัฒนาแบบ Clinical Dynamic Multi-Row</span>
        </div>
        <div>
          ID: QC-RT-MEATHA-HOSPITAL
        </div>
      </footer>
    </div>
  );
}
