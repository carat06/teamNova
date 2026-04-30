package com.trustid.controller;

import com.trustid.model.User;
import com.trustid.repository.UserRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/kyc")
@CrossOrigin(origins = "*")
public class KYCController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/verify")
    public ResponseEntity<?> verifyKYC(@RequestBody KYCRequest request) {
        try {
            String mobile = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            User user = userRepository.findByMobile(mobile)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            user.setName(request.getName());
            user.setDob(request.getDob());
            user.setFaceDescriptor(request.getFaceDescriptor());
            user.setPhotoBase64(request.getPhotoBase64());
            user.setCredential(request.getCredential());
            user.setCredentialSignature(request.getSignature());
            user.setBbsCredential(request.getBbsCredential());
            user.setKycStatus("VERIFIED");
            
            userRepository.save(user);
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("message", "KYC Verified successfully");
            result.put("user", user);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        String mobile = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User user = userRepository.findByMobile(mobile)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(user);
    }

    @Data
    public static class KYCRequest {
        private String name;
        private String dob;
        private String faceDescriptor;
        private String photoBase64;
        private String credential;
        private String signature;
        private String bbsCredential;
    }
}
