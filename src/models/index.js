import sequelize from '../config/database.js';
import School from './School.js';
import User from './User.js';
import Student from './Student.js';
import Teacher from './Teacher.js';
import Class from './Class.js';
import Section from './Section.js';
import Attendance from './Attendance.js';
import FeeStructure from './FeeStructure.js';
import FeePayment from './FeePayment.js';
import FeeCategory from './FeeCategory.js';
import StudentFeeAssignment from './StudentFeeAssignment.js';
import Exam from './Exam.js';
import ExamResult from './ExamResult.js';
import Notice from './Notice.js';
import AuditLog from './AuditLog.js';
import RefreshToken from './RefreshToken.js';
import Homework from './Homework.js';
import Book from './Book.js';
import BookIssue from './BookIssue.js';
import TransportRoute from './TransportRoute.js';
import TransportAssignment from './TransportAssignment.js';
import Broadcast from './Broadcast.js';
import Notification from './Notification.js';
import Enquiry from './Enquiry.js';
import Admission from './Admission.js';
import LeaveRequest from './LeaveRequest.js';
import PayrollRecord from './PayrollRecord.js';
import HostelRoom from './HostelRoom.js';
import HostelAllocation from './HostelAllocation.js';
import LmsCourse from './LmsCourse.js';
import InventoryItem from './InventoryItem.js';
import FeeConcession from './FeeConcession.js';

// School associations
School.hasMany(User, { foreignKey: 'school_id', as: 'users' });
School.hasMany(Student, { foreignKey: 'school_id', as: 'students' });
School.hasMany(Teacher, { foreignKey: 'school_id', as: 'teachers' });
School.hasMany(Class, { foreignKey: 'school_id', as: 'classes' });
School.hasMany(Section, { foreignKey: 'school_id', as: 'sections' });
School.hasMany(Attendance, { foreignKey: 'school_id', as: 'attendance' });
School.hasMany(FeeStructure, { foreignKey: 'school_id', as: 'feeStructures' });
School.hasMany(FeePayment, { foreignKey: 'school_id', as: 'feePayments' });
School.hasMany(FeeCategory, { foreignKey: 'school_id', as: 'feeCategories' });
School.hasMany(StudentFeeAssignment, { foreignKey: 'school_id', as: 'studentFeeAssignments' });
School.hasMany(Exam, { foreignKey: 'school_id', as: 'exams' });
School.hasMany(Notice, { foreignKey: 'school_id', as: 'notices' });
School.hasMany(AuditLog, { foreignKey: 'school_id', as: 'auditLogs' });
School.hasMany(Homework, { foreignKey: 'school_id', as: 'homework' });
School.hasMany(Book, { foreignKey: 'school_id', as: 'books' });
School.hasMany(BookIssue, { foreignKey: 'school_id', as: 'bookIssues' });
School.hasMany(TransportRoute, { foreignKey: 'school_id', as: 'transportRoutes' });
School.hasMany(TransportAssignment, { foreignKey: 'school_id', as: 'transportAssignments' });
School.hasMany(Broadcast, { foreignKey: 'school_id', as: 'broadcasts' });
School.hasMany(Notification, { foreignKey: 'school_id', as: 'notifications' });
School.hasMany(Enquiry, { foreignKey: 'school_id', as: 'enquiries' });
School.hasMany(Admission, { foreignKey: 'school_id', as: 'admissions' });
School.hasMany(LeaveRequest, { foreignKey: 'school_id', as: 'leaveRequests' });
School.hasMany(PayrollRecord, { foreignKey: 'school_id', as: 'payrollRecords' });
School.hasMany(HostelRoom, { foreignKey: 'school_id', as: 'hostelRooms' });
School.hasMany(HostelAllocation, { foreignKey: 'school_id', as: 'hostelAllocations' });
School.hasMany(LmsCourse, { foreignKey: 'school_id', as: 'lmsCourses' });
School.hasMany(InventoryItem, { foreignKey: 'school_id', as: 'inventoryItems' });
School.hasMany(FeeConcession, { foreignKey: 'school_id', as: 'feeConcessions' });

User.belongsTo(School, { foreignKey: 'school_id', as: 'school' });
Student.belongsTo(School, { foreignKey: 'school_id', as: 'school' });
Teacher.belongsTo(School, { foreignKey: 'school_id', as: 'school' });
Class.belongsTo(School, { foreignKey: 'school_id', as: 'school' });
Section.belongsTo(School, { foreignKey: 'school_id', as: 'school' });

User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Class.hasMany(Section, { foreignKey: 'class_id', as: 'sections' });
Section.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(Student, { foreignKey: 'class_id', as: 'students' });
Section.hasMany(Student, { foreignKey: 'section_id', as: 'students' });
Student.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });
Student.belongsTo(Section, { foreignKey: 'section_id', as: 'section' });

User.hasOne(Student, { foreignKey: 'user_id', as: 'studentProfile' });
User.hasOne(Teacher, { foreignKey: 'user_id', as: 'teacherProfile' });
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Teacher.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Student.hasMany(Attendance, { foreignKey: 'student_id', as: 'attendance' });
Attendance.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Student.hasMany(FeePayment, { foreignKey: 'student_id', as: 'feePayments' });
FeePayment.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
FeePayment.belongsTo(FeeStructure, { foreignKey: 'fee_structure_id', as: 'feeStructure' });
FeePayment.belongsTo(StudentFeeAssignment, { foreignKey: 'assignment_id', as: 'assignment' });

Class.hasMany(FeeStructure, { foreignKey: 'class_id', as: 'feeStructures' });
FeeCategory.hasMany(FeeStructure, { foreignKey: 'category_id', as: 'feeStructures' });
FeeStructure.belongsTo(FeeCategory, { foreignKey: 'category_id', as: 'category' });
FeeStructure.hasMany(StudentFeeAssignment, { foreignKey: 'fee_structure_id', as: 'assignments' });
Student.hasMany(StudentFeeAssignment, { foreignKey: 'student_id', as: 'feeAssignments' });
StudentFeeAssignment.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
StudentFeeAssignment.belongsTo(FeeStructure, { foreignKey: 'fee_structure_id', as: 'feeStructure' });
Class.hasMany(Exam, { foreignKey: 'class_id', as: 'exams' });
Class.hasMany(Homework, { foreignKey: 'class_id', as: 'homework' });

Exam.hasMany(ExamResult, { foreignKey: 'exam_id', as: 'results' });
ExamResult.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
ExamResult.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
School.hasMany(ExamResult, { foreignKey: 'school_id', as: 'examResults' });

Book.hasMany(BookIssue, { foreignKey: 'book_id', as: 'issues' });
BookIssue.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
BookIssue.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

TransportRoute.hasMany(TransportAssignment, { foreignKey: 'route_id', as: 'assignments' });
TransportAssignment.belongsTo(TransportRoute, { foreignKey: 'route_id', as: 'route' });
TransportAssignment.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

HostelRoom.hasMany(HostelAllocation, { foreignKey: 'room_id', as: 'allocations' });
HostelAllocation.belongsTo(HostelRoom, { foreignKey: 'room_id', as: 'room' });
HostelAllocation.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

export {
  sequelize,
  School,
  User,
  Student,
  Teacher,
  Class,
  Section,
  Attendance,
  FeeStructure,
  FeePayment,
  FeeCategory,
  StudentFeeAssignment,
  Exam,
  ExamResult,
  Notice,
  AuditLog,
  RefreshToken,
  Homework,
  Book,
  BookIssue,
  TransportRoute,
  TransportAssignment,
  Broadcast,
  Notification,
  Enquiry,
  Admission,
  LeaveRequest,
  PayrollRecord,
  HostelRoom,
  HostelAllocation,
  LmsCourse,
  InventoryItem,
  FeeConcession,
};

export default {
  sequelize,
  School,
  User,
  Student,
  Teacher,
  Class,
  Section,
  Attendance,
  FeeStructure,
  FeePayment,
  FeeCategory,
  StudentFeeAssignment,
  Exam,
  ExamResult,
  Notice,
  AuditLog,
  RefreshToken,
  Homework,
  Book,
  BookIssue,
  TransportRoute,
  TransportAssignment,
  Broadcast,
  Notification,
  Enquiry,
  Admission,
  LeaveRequest,
  PayrollRecord,
  HostelRoom,
  HostelAllocation,
  LmsCourse,
  InventoryItem,
  FeeConcession,
};

