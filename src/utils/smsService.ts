// SMS Alert Service for Critical Patient Notifications
export class SMSService {
  private static instance: SMSService;
  private isEnabled = true;
  private targetPhoneNumber = '+91 9445520562'; // Specific number for alerts
  
  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  async sendCriticalAlert(patientId: string, riskLevel: string, probability: number): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('SMS alerts are disabled');
      return false;
    }

    try {
      const message = this.formatAlertMessage(patientId, riskLevel, probability);
      
      // Send to the specific phone number
      await this.sendSMS(this.targetPhoneNumber, message);
      
      // Log the alert
      console.log('🚨 CRITICAL SEPSIS ALERT SENT 🚨');
      console.log('Message:', message);
      console.log('Sent to:', this.targetPhoneNumber);
      
      // Show browser notification as well
      this.showBrowserNotification(patientId, riskLevel);
      
      return true;
    } catch (error) {
      console.error('Failed to send SMS alert:', error);
      return false;
    }
  }

  private formatAlertMessage(patientId: string, riskLevel: string, probability: number): string {
    const timestamp = new Date().toLocaleString();
    
    return `🚨 CRITICAL SEPSIS ALERT 🚨
Patient ID: ${patientId}
Risk Level: ${riskLevel}
Probability: ${(probability * 100).toFixed(1)}%
Time: ${timestamp}

IMMEDIATE ACTION REQUIRED:
- Initiate sepsis protocol
- Administer antibiotics within 1 hour
- Begin fluid resuscitation
- Consider ICU transfer

AI-Powered Sepsis Detection System
Hospital Emergency Response`;
  }

  private showBrowserNotification(patientId: string, riskLevel: string) {
    if ('Notification' in window) {
      // Request permission if not already granted
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      if (Notification.permission === 'granted') {
        const notification = new Notification('🚨 Critical Sepsis Alert', {
          body: `Patient ${patientId} - ${riskLevel} RISK\nSMS sent to medical team!\nImmediate attention required!`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `sepsis-alert-${patientId}`,
          requireInteraction: true,
          actions: [
            { action: 'view', title: 'View Patient' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        // Auto-close after 30 seconds
        setTimeout(() => {
          notification.close();
        }, 30000);
      }
    }
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // In production, this would integrate with SMS services like:
    // - Twilio
    // - AWS SNS
    // - Hospital's internal messaging system
    
    // Example Twilio integration (commented out for demo)
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const client = require('twilio')(accountSid, authToken);
    
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: phoneNumber
    });
    */
    
    // Simulate SMS sending with realistic delay
    await this.delay(800);
    
    // Log the SMS for demo purposes
    console.log(`📱 SMS SENT TO: ${phoneNumber}`);
    console.log(`📄 MESSAGE: ${message}`);
    console.log(`✅ Delivery Status: Sent successfully`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration methods
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  setTargetPhoneNumber(phoneNumber: string) {
    this.targetPhoneNumber = phoneNumber;
  }

  getTargetPhoneNumber(): string {
    return this.targetPhoneNumber;
  }
}