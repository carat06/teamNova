package com.trustid.controller;

import com.trustid.model.User;
import com.trustid.repository.UserRepository;
import com.trustid.util.JwtUtil;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Optional<User> userOpt = userRepository.findByMobile(request.getMobile());
            User user;
            if (userOpt.isEmpty()) {
                user = User.builder()
                        .mobile(request.getMobile())
                        .kycStatus("PENDING")
                        .build();
                userRepository.save(user);
            } else {
                user = userOpt.get();
            }

            String token = jwtUtil.generateToken(user.getMobile());
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("token", token);
            response.put("user", user);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/profile/{mobile}")
    public ResponseEntity<?> getProfile(@PathVariable String mobile) {
        return userRepository.findByMobile(mobile)
                .map(user -> {
                    java.util.Map<String, Object> response = new java.util.HashMap<>();
                    response.put("mobile", user.getMobile());
                    response.put("faceDescriptor", user.getFaceDescriptor());
                    response.put("name", user.getName());
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/admin/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/search-face")
    public ResponseEntity<?> searchByFace(@RequestBody Map<String, List<Double>> request) {
        List<Double> currentDescriptor = request.get("descriptor");
        if (currentDescriptor == null) return ResponseEntity.badRequest().build();

        return userRepository.findAll().stream()
                .filter(user -> user.getFaceDescriptor() != null)
                .map(user -> {
                    try {
                        // Parse stored descriptor string to double array
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        List<Double> stored = mapper.readValue(user.getFaceDescriptor(), new com.fasterxml.jackson.core.type.TypeReference<List<Double>>() {});
                        
                        double distance = 0;
                        for (int i = 0; i < stored.size(); i++) {
                            distance += Math.pow(stored.get(i) - currentDescriptor.get(i), 2);
                        }
                        distance = Math.sqrt(distance);
                        
                        return new java.util.AbstractMap.SimpleEntry<>(user, distance);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(entry -> entry != null && entry.getValue() < 0.45) // Strict threshold
                .min(java.util.Comparator.comparingDouble(java.util.Map.Entry::getValue))
                .map(entry -> {
                    User user = entry.getKey();
                    String token = jwtUtil.generateToken(user.getMobile());
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("token", token);
                    response.put("user", user);
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.status(401).body(Map.of("message", "Face not recognized")));
    }

    @Data
    public static class LoginRequest {
        private String mobile;
    }
}
