// SMS Alert Service for Critical Patient Notifications
export class SMSService {
  private static instance: SMSService;
  private isEnabled = true; // In production, this would be configurable
  
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
      // In a real implementation, this would integrate with services like:
      // - Twilio
      // - AWS SNS
      // - Hospital's internal messaging system
      
      const message = this.formatAlertMessage(patientId, riskLevel, probability);
      const recipients = this.getEmergencyContacts();
      
      // Simulate SMS sending
      console.log('🚨 CRITICAL SEPSIS ALERT 🚨');
      console.log('Message:', message);
      console.log('Recipients:', recipients);
      
      // Simulate API call delay
      await this.delay(500);
      
      // In production, you would make actual API calls here:
      /*
      for (const recipient of recipients) {
        await this.sendSMS(recipient.phone, message);
      }
      */
      
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

Reply STOP to unsubscribe`;
  }

  private getEmergencyContacts(): Array<{ name: string; phone: string; role: string }> {
    // In production, this would come from a database or configuration
    return [
      { name: 'Dr. Sarah Johnson', phone: '+1-555-0123', role: 'ICU Attending' },
      { name: 'Nurse Manager Lisa Chen', phone: '+1-555-0124', role: 'Charge Nurse' },
      { name: 'Dr. Michael Rodriguez', phone: '+1-555-0125', role: 'Infectious Disease' },
      { name: 'Emergency Response Team', phone: '+1-555-0911', role: 'Rapid Response' }
    ];
  }

  private showBrowserNotification(patientId: string, riskLevel: string) {
    if ('Notification' in window) {
      // Request permission if not already granted
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      if (Notification.permission === 'granted') {
        const notification = new Notification('🚨 Critical Sepsis Alert', {
          body: `Patient ${patientId} - ${riskLevel} RISK\nImmediate medical attention required!`,
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
    
    // For demo purposes, just log the SMS
    console.log(`SMS to ${phoneNumber}: ${message}`);
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
}