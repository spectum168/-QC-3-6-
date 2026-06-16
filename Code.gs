/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Google Apps Script (Code.gs)
 * ระบบบันทึกข้อมูลและติดตามผลงาน QC ราย 3-6 เดือน ด้านกลไกและความเที่ยงตรง
 * แผนกรังสีเทคนิค โรงพยาบาลแม่ทา
 */

const SHEET_ID = "18jG7RJ4I5BIoPES85mkIl5JBNCu8KQaIBFzCQa9Egew";
const DRIVE_FOLDER_ID = "1gpz_bUEGkchKfq3hHueABybNqRM8HOss";

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบบันทึก QC คลินิกรังสีเทคนิค - รพ.แม่ทา')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ฟังก์ชันหลักในการบันทึกข้อมูลจากฟอร์มลง Google Sheets
 */
function submitQCReport(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0] || SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    
    const timestamp = new Date();
    const dateFormatted = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    
    // 1. จัดการอัปโหลดไฟล์ลายเซ็นผู้ตรวจ
    let signatureSurveyorUrl = "";
    if (data.signatureSurveyor && data.signatureSurveyor.startsWith("data:image")) {
      signatureSurveyorUrl = saveBase64ImageToDrive(data.signatureSurveyor, `Sig_Surveyor_${data.surveyorName}_${Date.now()}.png`, folder);
    }
    
    // 2. จัดการอัปโหลดไฟล์ลายเซ็นผู้ตรวจสอบ (หัวหน้างาน)
    let signatureChiefUrl = "";
    if (data.signatureChief && data.signatureChief.startsWith("data:image")) {
      signatureChiefUrl = saveBase64ImageToDrive(data.signatureChief, `Sig_Chief_${data.chiefName}_${Date.now()}.png`, folder);
    }
    
    // 3. จัดการอัปโหลดภาพสำหรับอุปกรณ์ป้องกันรังสีแบบ Dynamic
    const processedShields = [];
    if (data.shields && data.shields.length > 0) {
      for (let i = 0; i < data.shields.length; i++) {
        const shield = data.shields[i];
        let imageUrl = shield.imageLink || "";
        
        // หากมีการอัปโหลดภาพมาเป็น Base64
        if (shield.imageBase64 && shield.imageBase64.startsWith("data:image")) {
          const fileName = `Shield_${shield.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.png`;
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
    
    const shieldInfoText = processedShields.map(s => `${s.name} (${s.condition}, รอยแตก: ${s.crackCheck})`).join(" | ");
    const shieldUrlsText = processedShields.map(s => s.imageUrl).filter(url => url !== "").join(", ");
    
    // 4. แถวข้อมูลที่จะบันทึกลงในชีต
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
      data.mechChecklist.item7,                 // J: ปุ่มหยุดฉุกเฉิน (Emergency Stop)
      data.sidValue,                            // K: ระยะ SID
      data.errorX,                              // L: คลาดเคลื่อนแกน X
      data.errorY,                              // M: คลาดเคลื่อนแกน Y
      data.collimatorResult ? "ผ่าน" : "ไม่ผ่าน", // N: ผลตรวจสอบ Collimator
      shieldInfoText,                           // O: รายการอุปกรณ์และสภาพ
      shieldUrlsText,                           // P: ลิงก์รูปถ่ายอุปกรณ์ป้องกันรังสี
      signatureSurveyorUrl,                     // Q: ลิงก์ลายเซ็นผู้ตรวจ
      signatureChiefUrl                         // R: ลิงก์ลายเซ็นผู้ตรวจสอบ
    ];
    
    // บันทึกลงแถวใหม่
    sheet.appendRow(rowData);
    
    return {
      success: true,
      message: "บันทึกผลการตรวจสอบ QC และอัปโหลดไฟล์ภาพเข้าสู่คลังเรียบร้อยแล้ว!",
      timestamp: dateFormatted,
      surveyorSigUrl: signatureSurveyorUrl,
      chiefSigUrl: signatureChiefUrl,
      shieldUrls: processedShields.map(s => s.imageUrl)
    };
  } catch (err) {
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.toString()
    };
  }
}

/**
 * ฟังก์ชันช่วยแปลงข้อมูล Base64 และบันทึกเป็นรูปภาพลงโฟลเดอร์ Drive
 */
function saveBase64ImageToDrive(base64Data, fileName, folder) {
  try {
    const splitData = base64Data.split(",");
    const contentType = splitData[0].match(/:(.*?);/)[1];
    const rawData = splitData[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(rawData), contentType, fileName);
    const file = folder.createFile(blob);
    
    // กำหนดสิทธิ์ให้ทุกคนที่มีลิงก์สามารถเข้าถึงรูปภาพได้คัดลอกลิ้งก์สะดวก
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    Logger.log("ไม่สามารถเซฟรูปลงไดรฟ์ได้: " + e.toString());
    return "error: " + e.toString();
  }
}
